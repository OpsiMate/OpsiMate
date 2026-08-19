import { AlertHistoryEventType, Incident, IncidentSummary, Logger } from '@OpsiMate/shared';
import { AlertHistoryRepository } from '../../dal/alertHistoryRepository';
import { IncidentRepository, MembershipTransition, UpdateIncidentInput } from '../../dal/incidentRepository';

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

// Thrown when a request names alerts that do not exist (in either table); the
// controller maps it to a 400 with the offending ids.
export class UnknownAlertIdsError extends Error {
	constructor(public readonly unknownIds: string[]) {
		super(`Unknown alert ids: ${unknownIds.join(', ')}`);
		this.name = 'UnknownAlertIdsError';
	}
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

	// History reflects what CHANGED, not what was requested: a no-op re-add records
	// nothing, and a re-homed alert gets a "removed" event on the incident it left
	// before its "added" event on the new one.
	private async recordAddTransitions(
		transitions: MembershipTransition[],
		targetIncidentId: number,
		targetName: string,
		actor: IncidentActor
	): Promise<void> {
		const genuinelyAdded = transitions.filter((t) => t.previousIncidentId !== targetIncidentId);
		const rehomedByPrevious = new Map<number, string[]>();
		for (const t of genuinelyAdded) {
			if (t.previousIncidentId === null) continue;
			const list = rehomedByPrevious.get(t.previousIncidentId);
			if (list) list.push(t.alertId);
			else rehomedByPrevious.set(t.previousIncidentId, [t.alertId]);
		}
		for (const [previousId, alertIds] of rehomedByPrevious) {
			// The previous incident may already be dissolved by the time we look; its id
			// is still an honest name for the history line.
			const previous = await this.incidentRepo.getIncidentById(previousId);
			await this.recordMembershipEvents(
				alertIds,
				AlertHistoryEventType.INCIDENT_REMOVED,
				previous?.name ?? `#${previousId}`,
				actor
			);
		}
		await this.recordMembershipEvents(
			genuinelyAdded.map((t) => t.alertId),
			AlertHistoryEventType.INCIDENT_ADDED,
			targetName,
			actor
		);
	}

	private async assertAlertsExist(alertIds: string[]): Promise<void> {
		const existing = await this.incidentRepo.filterExistingAlertIds(alertIds);
		const unknown = alertIds.filter((id) => !existing.has(id));
		if (unknown.length > 0) throw new UnknownAlertIdsError(unknown);
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
		await this.assertAlertsExist(request.alertIds);
		// The default name needs the id, so create first and rename when unnamed.
		const { lastID } = await this.incidentRepo.createIncident({
			name: request.name?.trim() || 'pending',
			description: request.description?.trim() || null,
			createdBy: actor.id,
		});
		if (!request.name?.trim()) {
			await this.incidentRepo.updateIncident(lastID, { name: `Incident #${lastID}` });
		}
		const { transitions } = await this.incidentRepo.addAlerts(lastID, request.alertIds);

		const summary = await this.incidentRepo.getIncidentSummaryById(lastID);
		if (!summary) throw new Error(`Incident ${lastID} vanished right after creation`);
		// Removal events for re-homed alerts must be written BEFORE the emptied source
		// incidents dissolve, while their names are still readable.
		await this.recordAddTransitions(transitions, lastID, summary.name, actor);
		await this.dissolveIfEmpty(
			transitions.map((t) => t.previousIncidentId).filter((id): id is number => id !== null)
		);
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
		await this.assertAlertsExist(alertIds);
		const { transitions } = await this.incidentRepo.addAlerts(id, alertIds);
		await this.recordAddTransitions(transitions, id, incident.name, actor);
		await this.dissolveIfEmpty(
			transitions.map((t) => t.previousIncidentId).filter((prev): prev is number => prev !== null)
		);
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
		const { removedAlertIds } = await this.incidentRepo.removeAlerts(id, alertIds);
		await this.recordMembershipEvents(
			removedAlertIds,
			AlertHistoryEventType.INCIDENT_REMOVED,
			incident.name,
			actor
		);
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
