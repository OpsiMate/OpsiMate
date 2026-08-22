import {
	Alert,
	AuditActionType,
	AuditResourceType,
	criteriaMatchesAlert,
	Logger,
	MutePolicy,
	User,
} from '@OpsiMate/shared';
import { MutePolicyRepository, CreateMutePolicyInput, UpdateMutePolicyInput } from '../../dal/mutePolicyRepository';
import { AuditBL } from '../audit/audit.bl';

const logger = new Logger('bl/mutePolicy.bl');

const API_TOKEN_ACTOR_ID = 0;
const API_TOKEN_ACTOR_NAME = 'API Token';

export class MutePolicyBL {
	// Mute rules change what markMuted stamps on every alert, so the alerts snapshot
	// cache must drop when a rule changes; wired to AlertBL.invalidateSnapshots in app.ts.
	private onRulesChanged: (() => void) | null = null;

	constructor(
		private mutePolicyRepo: MutePolicyRepository,
		private auditBL: AuditBL
	) {}

	setOnRulesChanged(callback: () => void): void {
		this.onRulesChanged = callback;
	}

	async create(data: CreateMutePolicyInput, actor?: User | null): Promise<MutePolicy> {
		const { lastID } = await this.mutePolicyRepo.createMutePolicy(data);
		const created = await this.mutePolicyRepo.getMutePolicyById(lastID);
		if (!created) {
			throw new Error('Failed to retrieve created mute policy');
		}
		this.onRulesChanged?.();
		await this.recordAuditAction(AuditActionType.CREATE, created, actor);
		return created;
	}

	async list(): Promise<MutePolicy[]> {
		return this.mutePolicyRepo.getAllMutePolicies();
	}

	async get(id: number): Promise<MutePolicy | undefined> {
		return this.mutePolicyRepo.getMutePolicyById(id);
	}

	async update(id: number, data: UpdateMutePolicyInput, actor?: User | null): Promise<MutePolicy | undefined> {
		const shouldAudit = this.hasUpdateData(data);
		await this.mutePolicyRepo.updateMutePolicy(id, data);
		this.onRulesChanged?.();
		const updated = await this.mutePolicyRepo.getMutePolicyById(id);
		if (updated && shouldAudit) {
			await this.recordAuditAction(AuditActionType.UPDATE, updated, actor, JSON.stringify(data));
		}
		return updated;
	}

	async delete(id: number, actor?: User | null): Promise<void> {
		const existing = await this.mutePolicyRepo.getMutePolicyById(id);
		await this.mutePolicyRepo.deleteMutePolicy(id);
		this.onRulesChanged?.();
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

	private hasUpdateData(data: UpdateMutePolicyInput): boolean {
		return (
			data.name !== undefined ||
			data.nameContains !== undefined ||
			data.nameContainsAny !== undefined ||
			data.labelMatchers !== undefined ||
			data.labelMatcherGroups !== undefined ||
			data.matchAll !== undefined ||
			data.startsAt !== undefined ||
			data.endsAt !== undefined ||
			data.schedule !== undefined ||
			data.reason !== undefined
		);
	}

	private async recordAuditAction(
		actionType: AuditActionType,
		mutePolicy: MutePolicy,
		actor?: User | null,
		details?: string
	): Promise<void> {
		try {
			const auditActor = this.getAuditActor(actor);
			await this.auditBL.logAction({
				actionType,
				resourceType: AuditResourceType.MUTE_POLICY,
				resourceId: String(mutePolicy.id),
				userId: auditActor.userId,
				userName: auditActor.userName,
				resourceName: mutePolicy.name,
				details,
			});
		} catch (error) {
			logger.error(`Failed to record mute policy audit event (${actionType}) for ${mutePolicy.id}`, error);
		}
	}

	static isMutePolicyActive(mutePolicy: MutePolicy, now: Date = new Date()): boolean {
		if (mutePolicy.schedule) {
			const { daysOfWeek, startTime, endTime } = mutePolicy.schedule;
			if (!daysOfWeek?.length || !startTime || !endTime) return false;
			if (!daysOfWeek.includes(now.getDay())) return false;
			const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
			return current >= startTime && current < endTime;
		}
		const ts = now.getTime();
		if (mutePolicy.startsAt) {
			const start = new Date(mutePolicy.startsAt).getTime();
			if (Number.isFinite(start) && ts < start) return false;
		}
		if (mutePolicy.endsAt) {
			const end = new Date(mutePolicy.endsAt).getTime();
			if (Number.isFinite(end) && ts >= end) return false;
		}
		return true;
	}

	static mutePolicyMatchesAlert(mutePolicy: MutePolicy, alert: Alert): boolean {
		// One shared matcher for mute policies, enrichments and actions (see
		// criteriaMatchesAlert): name substrings OR together, label groups OR together,
		// and the two AND. A policy with no criteria at all matches nothing — muting
		// everything by accident is the failure mode worth preventing.
		return criteriaMatchesAlert(mutePolicy, alert, { emptyCriteriaMatches: false });
	}

	async markMuted(alerts: Alert[]): Promise<Alert[]> {
		try {
			const mutePolicies = await this.mutePolicyRepo.getAllMutePolicies();
			const active = mutePolicies.filter((s) => MutePolicyBL.isMutePolicyActive(s));
			if (active.length === 0) return alerts;
			return alerts.map((alert) =>
				active.some((s) => MutePolicyBL.mutePolicyMatchesAlert(s, alert)) ? { ...alert, isMuted: true } : alert
			);
		} catch (err) {
			logger.error('Failed to apply mute policy tagging, returning alerts unchanged', err);
			return alerts;
		}
	}
}
