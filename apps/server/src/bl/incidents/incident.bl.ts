import { AlertHistoryEventType, Incident, IncidentSummary, Logger } from '@OpsiMate/shared';
import { AlertHistoryRepository } from '../../dal/alertHistoryRepository';
import { IncidentRepository, UpdateIncidentInput } from '../../dal/incidentRepository';

const logger = new Logger('bl/incidents');

export interface IncidentActor {
	id: number | null;
	name: string | null;
}

export interface CreateIncidentRequest {
	name?: string;
	description?: string;
	alertIds: string[];
}

export class IncidentBL {
	constructor(
		private incidentRepo: IncidentRepository,
		private alertHistoryRepo: AlertHistoryRepository,
		// Membership changes alter the incidentId attached to alert snapshots; the alert
		// BL owns those caches, so it hands us its invalidator instead of itself (a
		// direct reference would be a dependency cycle: alert.bl already reads the
		// incident repo to attach memberships).
		private invalidateAlertSnapshots: () => void
	) {}

	private async recordMembershipEvents(
		alertIds: string[],
		eventType: AlertHistoryEventType,
		incidentName: string,
		actor: IncidentActor
	): Promise<void> {
		const verb = eventType === AlertHistoryEventType.INCIDENT_ADDED ? 'Grouped into' : 'Removed from';
		await Promise.all(
			alertIds.map((alertId) =>
				this.alertHistoryRepo.recordEvent({
					alertId,
					eventType,
					actorName: actor.name,
					description: `${verb} incident "${incidentName}"`,
				})
			)
		);
	}

	// Dissolve incidents that a re-homing or a delete-forever emptied. An empty incident
	// is invisible in the alerts table (no members to fold under it), so keeping the row
	// would strand it un-deletable from the UI.
	private async dissolveIfEmpty(incidentIds: number[]): Promise<void> {
		for (const id of new Set(incidentIds)) {
			const count = await this.incidentRepo.getMemberCount(id);
			if (count === 0) {
				logger.info(`Incident ${id} emptied; dissolving`);
				await this.incidentRepo.deleteIncident(id);
			}
		}
	}

	async create(request: CreateIncidentRequest, actor: IncidentActor): Promise<IncidentSummary> {
		// The default name needs the id, so create first and rename when unnamed.
		const { lastID } = await this.incidentRepo.createIncident({
			name: request.name?.trim() || 'pending',
			description: request.description?.trim() || null,
			createdBy: actor.id,
		});
		if (!request.name?.trim()) {
			await this.incidentRepo.updateIncident(lastID, { name: `Incident #${lastID}` });
		}
		const { previousIncidentIds } = await this.incidentRepo.addAlerts(lastID, request.alertIds);
		await this.dissolveIfEmpty(previousIncidentIds);

		const summary = await this.incidentRepo.getIncidentSummaryById(lastID);
		if (!summary) throw new Error(`Incident ${lastID} vanished right after creation`);
		await this.recordMembershipEvents(request.alertIds, AlertHistoryEventType.INCIDENT_ADDED, summary.name, actor);
		this.invalidateAlertSnapshots();
		return summary;
	}

	async list(): Promise<IncidentSummary[]> {
		// Sweep on read: retention (and any other hard-delete path) purges alerts with
		// raw SQL, and this is the cheap place to keep membership honest afterwards.
		await this.incidentRepo.pruneDanglingMemberships();
		return this.incidentRepo.getIncidentSummaries();
	}

	async get(id: number): Promise<IncidentSummary | undefined> {
		return this.incidentRepo.getIncidentSummaryById(id);
	}

	async update(id: number, data: UpdateIncidentInput): Promise<Incident | undefined> {
		await this.incidentRepo.updateIncident(id, data);
		return this.incidentRepo.getIncidentById(id);
	}

	async addAlerts(id: number, alertIds: string[], actor: IncidentActor): Promise<IncidentSummary | undefined> {
		const incident = await this.incidentRepo.getIncidentById(id);
		if (!incident) return undefined;
		const { previousIncidentIds } = await this.incidentRepo.addAlerts(id, alertIds);
		await this.dissolveIfEmpty(previousIncidentIds);
		await this.recordMembershipEvents(alertIds, AlertHistoryEventType.INCIDENT_ADDED, incident.name, actor);
		this.invalidateAlertSnapshots();
		return this.incidentRepo.getIncidentSummaryById(id);
	}

	// Removing the last member dissolves the incident: an empty folder can't be seen or
	// managed from the table, so it must not linger. Returns whether it survived.
	async removeAlerts(
		id: number,
		alertIds: string[],
		actor: IncidentActor
	): Promise<{ dissolved: boolean } | undefined> {
		const incident = await this.incidentRepo.getIncidentById(id);
		if (!incident) return undefined;
		await this.incidentRepo.removeAlerts(id, alertIds);
		await this.recordMembershipEvents(alertIds, AlertHistoryEventType.INCIDENT_REMOVED, incident.name, actor);
		const remaining = await this.incidentRepo.getMemberCount(id);
		if (remaining === 0) {
			await this.incidentRepo.deleteIncident(id);
		}
		this.invalidateAlertSnapshots();
		return { dissolved: remaining === 0 };
	}

	// Ungroup: incident dies, alerts survive untouched.
	async delete(id: number, actor: IncidentActor): Promise<boolean> {
		const incident = await this.incidentRepo.getIncidentById(id);
		if (!incident) return false;
		const { memberAlertIds } = await this.incidentRepo.deleteIncident(id);
		await this.recordMembershipEvents(memberAlertIds, AlertHistoryEventType.INCIDENT_REMOVED, incident.name, actor);
		this.invalidateAlertSnapshots();
		return true;
	}

	// Hook for the alerts delete-forever paths: memberships must not dangle after their
	// alert is permanently gone, and incidents this empties dissolve.
	async handleAlertsDeleted(alertIds: string[]): Promise<void> {
		const { affectedIncidentIds } = await this.incidentRepo.removeMembershipForAlerts(alertIds);
		if (affectedIncidentIds.length > 0) {
			await this.dissolveIfEmpty(affectedIncidentIds);
			this.invalidateAlertSnapshots();
		}
	}
}
