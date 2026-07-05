import {
	Alert,
	AlertEnrichment,
	AppliedEnrichment,
	AuditActionType,
	AuditResourceType,
	Logger,
	User,
} from '@OpsiMate/shared';
import { CreateEnrichmentInput, EnrichmentRepository, UpdateEnrichmentInput } from '../../dal/enrichmentRepository';
import { AuditBL } from '../audit/audit.bl';

const logger = new Logger('bl/enrichment.bl');

const API_TOKEN_ACTOR_ID = 0;
const API_TOKEN_ACTOR_NAME = 'API Token';

export class EnrichmentBL {
	constructor(
		private enrichmentRepo: EnrichmentRepository,
		private auditBL: AuditBL
	) {}

	async create(data: CreateEnrichmentInput, actor?: User | null): Promise<AlertEnrichment> {
		const { lastID } = await this.enrichmentRepo.createEnrichment(data, actor?.fullName);
		const created = await this.enrichmentRepo.getEnrichmentById(lastID);
		if (!created) {
			throw new Error('Failed to retrieve created enrichment');
		}
		await this.recordAuditAction(AuditActionType.CREATE, created, actor);
		return created;
	}

	async list(): Promise<AlertEnrichment[]> {
		return this.enrichmentRepo.getAllEnrichments();
	}

	async get(id: number): Promise<AlertEnrichment | undefined> {
		return this.enrichmentRepo.getEnrichmentById(id);
	}

	async update(id: number, data: UpdateEnrichmentInput, actor?: User | null): Promise<AlertEnrichment | undefined> {
		await this.enrichmentRepo.updateEnrichment(id, data, actor?.fullName);
		const updated = await this.enrichmentRepo.getEnrichmentById(id);
		if (updated) {
			await this.recordAuditAction(AuditActionType.UPDATE, updated, actor, JSON.stringify(data));
		}
		return updated;
	}

	async delete(id: number, actor?: User | null): Promise<void> {
		const existing = await this.enrichmentRepo.getEnrichmentById(id);
		await this.enrichmentRepo.deleteEnrichment(id);
		if (existing) {
			await this.recordAuditAction(AuditActionType.DELETE, existing, actor);
		}
	}

	private getAuditActor(actor?: User | null): { userId: number; userName: string } {
		const parsedUserId = actor?.id !== undefined ? Number(actor.id) : NaN;
		return {
			userId: Number.isFinite(parsedUserId) ? parsedUserId : API_TOKEN_ACTOR_ID,
			userName: actor?.fullName ?? API_TOKEN_ACTOR_NAME,
		};
	}

	private async recordAuditAction(
		actionType: AuditActionType,
		enrichment: AlertEnrichment,
		actor?: User | null,
		details?: string
	): Promise<void> {
		try {
			const auditActor = this.getAuditActor(actor);
			await this.auditBL.logAction({
				actionType,
				resourceType: AuditResourceType.ENRICHMENT,
				resourceId: String(enrichment.id),
				userId: auditActor.userId,
				userName: auditActor.userName,
				resourceName: enrichment.name,
				details,
			});
		} catch (error) {
			logger.error(`Failed to record enrichment audit event (${actionType}) for ${enrichment.id}`, error);
		}
	}

	// Same matching semantics as silences: nameContains is a case-insensitive substring match
	// on the alert name, and every label matcher must equal the alert's tag value.
	static enrichmentMatchesAlert(enrichment: AlertEnrichment, alert: Alert): boolean {
		const hasName = !!enrichment.nameContains && enrichment.nameContains.trim().length > 0;
		const matchers = enrichment.labelMatchers ?? [];

		if (!hasName && matchers.length === 0) return false;

		if (hasName) {
			const needle = enrichment.nameContains!.trim().toLowerCase();
			if (!alert.alertName?.toLowerCase().includes(needle)) return false;
		}

		for (const matcher of matchers) {
			const tagValue = alert.tags?.[matcher.key];
			if (tagValue === undefined) return false;
			if (String(tagValue) !== matcher.value) return false;
		}
		return true;
	}

	// Templates may reference the alert's current values; enrichments chain in order, so a
	// later rule's {{summary}} sees the previous rule's output.
	// Templates can reference the alert's own values. Besides {{summary}}, {{name}} and
	// {{status}}, any label/tag is available as {{label.<key>}} (alias {{tag.<key>}}), e.g.
	// {{label.host}}. Unknown placeholders are left untouched.
	private static resolveTemplate(template: string, alert: Alert): string {
		const ctx: Record<string, string> = {
			summary: alert.summary ?? '',
			name: alert.alertName ?? '',
			status: alert.status ?? '',
		};
		for (const [key, value] of Object.entries(alert.tags ?? {})) {
			ctx[`label.${key}`] = String(value);
			ctx[`tag.${key}`] = String(value);
		}
		return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => (key in ctx ? ctx[key] : match));
	}

	// claimedKeys tracks fields already set by a higher-priority rule in this pass, so the
	// higher-priority rule's value wins same-key conflicts (rules may still override the
	// alert's original tags).
	private static applyToAlert(enrichment: AlertEnrichment, alert: Alert, claimedKeys: Set<string>): Alert {
		const tags = { ...alert.tags };
		for (const field of enrichment.addFields ?? []) {
			if (claimedKeys.has(field.key)) continue;
			// Field values are templated too, so a field can copy a label, e.g. owner={{label.team}}.
			tags[field.key] = EnrichmentBL.resolveTemplate(field.value, alert);
			claimedKeys.add(field.key);
		}
		const summary =
			enrichment.summaryTemplate && enrichment.summaryTemplate.trim().length > 0
				? EnrichmentBL.resolveTemplate(enrichment.summaryTemplate, alert)
				: alert.summary;
		return { ...alert, tags, summary };
	}

	// Decorate alerts with all matching enrichment rules. Applied at fetch time only —
	// nothing is persisted on the alerts themselves.
	//
	// When an alert matches several rules they chain by rank: highest priority first
	// (ties break by creation order, oldest first). Each rule sees the previous rule's
	// output, so summary templates compose in priority order, and on a conflicting field
	// key the higher-priority rule wins. A rule can also match on tags added by an
	// earlier (higher-priority) rule in the same pass.
	async applyEnrichments(alerts: Alert[]): Promise<Alert[]> {
		try {
			const enrichments = (await this.enrichmentRepo.getAllEnrichments()).sort(
				(a, b) => b.priority - a.priority || a.id - b.id
			);
			if (enrichments.length === 0) return alerts;
			return alerts.map((alert) => {
				let enriched = alert;
				const claimedKeys = new Set<string>();
				const applied: AppliedEnrichment[] = [];
				for (const enrichment of enrichments) {
					if (EnrichmentBL.enrichmentMatchesAlert(enrichment, enriched)) {
						enriched = EnrichmentBL.applyToAlert(enrichment, enriched, claimedKeys);
						applied.push({ id: enrichment.id, name: enrichment.name });
					}
				}
				// Expose which rules decorated this alert so the UI can show it was enriched.
				return applied.length > 0 ? { ...enriched, appliedEnrichments: applied } : enriched;
			});
		} catch (err) {
			logger.error('Failed to apply alert enrichments, returning alerts unchanged', err);
			return alerts;
		}
	}
}
