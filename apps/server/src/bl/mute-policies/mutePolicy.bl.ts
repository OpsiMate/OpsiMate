import { Alert, MutePolicy, Logger } from '@OpsiMate/shared';
import { MutePolicyRepository, CreateMutePolicyInput, UpdateMutePolicyInput } from '../../dal/mutePolicyRepository';

const logger = new Logger('bl/mutePolicy.bl');

export class MutePolicyBL {
	constructor(private mutePolicyRepo: MutePolicyRepository) {}

	async create(data: CreateMutePolicyInput): Promise<MutePolicy> {
		const { lastID } = await this.mutePolicyRepo.createMutePolicy(data);
		const created = await this.mutePolicyRepo.getMutePolicyById(lastID);
		if (!created) {
			throw new Error('Failed to retrieve created mute policy');
		}
		return created;
	}

	async list(): Promise<MutePolicy[]> {
		return this.mutePolicyRepo.getAllMutePolicies();
	}

	async get(id: number): Promise<MutePolicy | undefined> {
		return this.mutePolicyRepo.getMutePolicyById(id);
	}

	async update(id: number, data: UpdateMutePolicyInput): Promise<MutePolicy | undefined> {
		await this.mutePolicyRepo.updateMutePolicy(id, data);
		return this.mutePolicyRepo.getMutePolicyById(id);
	}

	async delete(id: number): Promise<void> {
		await this.mutePolicyRepo.deleteMutePolicy(id);
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
		const hasName = !!mutePolicy.nameContains && mutePolicy.nameContains.trim().length > 0;
		const matchers = mutePolicy.labelMatchers ?? [];

		if (!hasName && matchers.length === 0) return false;

		if (hasName) {
			const needle = mutePolicy.nameContains!.trim().toLowerCase();
			if (!alert.alertName?.toLowerCase().includes(needle)) return false;
		}

		for (const matcher of matchers) {
			const tagValue = alert.tags?.[matcher.key];
			if (tagValue === undefined) return false;
			if (String(tagValue) !== matcher.value) return false;
		}
		return true;
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
