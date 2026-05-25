import { Alert, AlertSilence, Logger } from '@OpsiMate/shared';
import { SilenceRepository, CreateSilenceInput, UpdateSilenceInput } from '../../dal/silenceRepository';

const logger = new Logger('bl/silence.bl');

export class SilenceBL {
	constructor(private silenceRepo: SilenceRepository) {}

	async create(data: CreateSilenceInput): Promise<AlertSilence> {
		const { lastID } = await this.silenceRepo.createSilence(data);
		const created = await this.silenceRepo.getSilenceById(lastID);
		if (!created) {
			throw new Error('Failed to retrieve created silence');
		}
		return created;
	}

	async list(): Promise<AlertSilence[]> {
		return this.silenceRepo.getAllSilences();
	}

	async get(id: number): Promise<AlertSilence | undefined> {
		return this.silenceRepo.getSilenceById(id);
	}

	async update(id: number, data: UpdateSilenceInput): Promise<AlertSilence | undefined> {
		await this.silenceRepo.updateSilence(id, data);
		return this.silenceRepo.getSilenceById(id);
	}

	async delete(id: number): Promise<void> {
		await this.silenceRepo.deleteSilence(id);
	}

	static isSilenceActive(silence: AlertSilence, now: Date = new Date()): boolean {
		if (silence.schedule) {
			const { daysOfWeek, startTime, endTime } = silence.schedule;
			if (!daysOfWeek?.length || !startTime || !endTime) return false;
			if (!daysOfWeek.includes(now.getDay())) return false;
			const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
			return current >= startTime && current < endTime;
		}
		const ts = now.getTime();
		if (silence.startsAt) {
			const start = new Date(silence.startsAt).getTime();
			if (Number.isFinite(start) && ts < start) return false;
		}
		if (silence.endsAt) {
			const end = new Date(silence.endsAt).getTime();
			if (Number.isFinite(end) && ts >= end) return false;
		}
		return true;
	}

	static silenceMatchesAlert(silence: AlertSilence, alert: Alert): boolean {
		const hasName = !!silence.nameContains && silence.nameContains.trim().length > 0;
		const matchers = silence.labelMatchers ?? [];

		if (!hasName && matchers.length === 0) return false;

		if (hasName) {
			const needle = silence.nameContains!.trim().toLowerCase();
			if (!alert.alertName?.toLowerCase().includes(needle)) return false;
		}

		for (const matcher of matchers) {
			const tagValue = alert.tags?.[matcher.key];
			if (tagValue === undefined) return false;
			if (String(tagValue) !== matcher.value) return false;
		}
		return true;
	}

	async markSilenced(alerts: Alert[]): Promise<Alert[]> {
		try {
			const silences = await this.silenceRepo.getAllSilences();
			const active = silences.filter((s) => SilenceBL.isSilenceActive(s));
			if (active.length === 0) return alerts;
			return alerts.map((alert) =>
				active.some((s) => SilenceBL.silenceMatchesAlert(s, alert))
					? { ...alert, isSilenced: true }
					: alert
			);
		} catch (err) {
			logger.error('Failed to apply silence tagging, returning alerts unchanged', err);
			return alerts;
		}
	}
}
