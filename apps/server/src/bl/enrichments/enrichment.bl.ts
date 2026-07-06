import { Alert, AlertEnrichment, AppliedEnrichment, Logger, normalizeAlertSeverity } from '@OpsiMate/shared';
import { CreateEnrichmentInput, EnrichmentRepository, UpdateEnrichmentInput } from '../../dal/enrichmentRepository';

const logger = new Logger('bl/enrichment.bl');

export class EnrichmentBL {
	constructor(private enrichmentRepo: EnrichmentRepository) {}

	async create(data: CreateEnrichmentInput, actor?: string | null): Promise<AlertEnrichment> {
		const { lastID } = await this.enrichmentRepo.createEnrichment(data, actor);
		const created = await this.enrichmentRepo.getEnrichmentById(lastID);
		if (!created) {
			throw new Error('Failed to retrieve created enrichment');
		}
		return created;
	}

	async list(): Promise<AlertEnrichment[]> {
		return this.enrichmentRepo.getAllEnrichments();
	}

	async get(id: number): Promise<AlertEnrichment | undefined> {
		return this.enrichmentRepo.getEnrichmentById(id);
	}

	async update(id: number, data: UpdateEnrichmentInput, actor?: string | null): Promise<AlertEnrichment | undefined> {
		await this.enrichmentRepo.updateEnrichment(id, data, actor);
		return this.enrichmentRepo.getEnrichmentById(id);
	}

	async delete(id: number): Promise<void> {
		await this.enrichmentRepo.deleteEnrichment(id);
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
		// First-class severity was resolved at ingestion; a rule that sets a severity
		// field overrides it, so enrichment stays able to reclassify alerts.
		let severity = alert.severity;
		for (const field of enrichment.addFields ?? []) {
			if (claimedKeys.has(field.key)) continue;
			// Field values are templated too, so a field can copy a label, e.g. owner={{label.team}}.
			tags[field.key] = EnrichmentBL.resolveTemplate(field.value, alert);
			claimedKeys.add(field.key);
			if (field.key === 'severity') {
				severity = normalizeAlertSeverity(tags[field.key]);
			}
		}
		const summary =
			enrichment.summaryTemplate && enrichment.summaryTemplate.trim().length > 0
				? EnrichmentBL.resolveTemplate(enrichment.summaryTemplate, alert)
				: alert.summary;
		return { ...alert, tags, summary, severity };
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
