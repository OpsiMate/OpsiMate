import { AlertHistoryEventType, Incident, IncidentSummary, Logger } from '@OpsiMate/shared';
import { AlertHistoryRepository } from '../../dal/alertHistoryRepository';
import { IncidentRepository, MembershipTransition, UpdateIncidentInput } from '../../dal/incidentRepository';

const logger = new Logger('bl/incidents');

export interface IncidentActor {
	id: number | null;
	name: string | null;
}

// User ids travel as strings on requests and alert callbacks; incidents store the
// creator as the users table's integer id, so only a numeric id is kept (an API-token
// caller has none). The one place both the controller and the alert hooks convert.
export const toIncidentActor = (
	id: string | number | null | undefined,
	name: string | null | undefined
): IncidentActor => {
	const numeric = id != null ? Number(id) : NaN;
	return { id: Number.isInteger(numeric) ? numeric : null, name: name ?? null };
};

// alertIds bucketed by the incident each one maps to; alerts with no incident are skipped.
const groupByIncident = (alertIds: string[], incidentOf: (alertId: string) => number | null | undefined) => {
	const byIncident = new Map<number, string[]>();
	for (const alertId of alertIds) {
		const incidentId = incidentOf(alertId);
		if (incidentId == null) continue;
		const list = byIncident.get(incidentId);
		if (list) list.push(alertId);
		else byIncident.set(incidentId, [alertId]);
	}
	return byIncident;
};

// What the incident BL needs from the alerts BL. A port rather than the BL itself:
// alert.bl already reads the incident repo to stamp memberships, so a direct reference
// would be a dependency cycle.
export interface IncidentAlertsPort {
	// Membership changes alter the incidentId stamped on alert snapshots.
	invalidateSnapshots(): void;
	// Assign the actor to every listed alert that has no owner yet (either table).
	claimUnowned(alertIds: string[], actor: IncidentActor): Promise<void>;
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

// Actor for changes the system makes on its own (no user behind the request).
const SYSTEM_ACTOR: IncidentActor = { id: null, name: 'System' };

export class IncidentBL {
	constructor(
		private incidentRepo: IncidentRepository,
		private alertHistoryRepo: AlertHistoryRepository,
		private alerts: IncidentAlertsPort
	) {}

	private async recordMembershipEvents(
		alertIds: string[],
		eventType: AlertHistoryEventType,
		incidentName: string,
		actor: IncidentActor,
		reason?: string
	): Promise<void> {
		const verb = eventType === AlertHistoryEventType.INCIDENT_ADDED ? 'Grouped into' : 'Removed from';
		const description = `${verb} incident "${incidentName}"` + (reason ? ` — ${reason}` : '');
		// Best-effort, per alert: history is written after the membership change committed,
		// so one failed insert must neither fail the request nor skip the other alerts.
		await Promise.all(
			alertIds.map(async (alertId) => {
				try {
					await this.alertHistoryRepo.recordEvent({
						alertId,
						eventType,
						actorName: actor.name,
						description,
					});
				} catch (error) {
					logger.error(
						`Failed to record ${eventType} history for alert ${alertId} (incident "${incidentName}")`,
						error
					);
				}
			})
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
		const previousOf = new Map(genuinelyAdded.map((t) => [t.alertId, t.previousIncidentId]));
		const rehomedByPrevious = groupByIncident(
			genuinelyAdded.map((t) => t.alertId),
			(alertId) => previousOf.get(alertId)
		);
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

	// The bookkeeping that follows a committed membership change (create or add). All of
	// it is best-effort: the memberships are durable by now, and a 500 after the commit
	// would invite a retry that creates a SECOND incident or moves the alerts again. Each
	// step is isolated, so a history hiccup never skips the ownership claim.
	//
	// Order matters: removal events for re-homed alerts are written BEFORE the emptied
	// source incidents dissolve, while their names are still readable. Then the ownership
	// rule — grouping is taking charge: `owner` gets every member nobody owned yet, and
	// members that already have an owner keep them. This is what keeps an incident whole
	// in the split-by-owner view; see handleAlertUnassigned for the other half.
	private async afterMembersAdded(
		incident: { id: number; name: string },
		transitions: MembershipTransition[],
		actor: IncidentActor,
		owner: IncidentActor,
		context: string
	): Promise<void> {
		const bestEffort = async (what: string, step: () => Promise<void>) => {
			try {
				await step();
			} catch (error) {
				logger.error(`${context}, but ${what} failed`, error);
			}
		};
		const previousIds = transitions
			.map((t) => t.previousIncidentId)
			.filter((prev): prev is number => prev !== null && prev !== incident.id);
		await bestEffort('recording membership history', () =>
			this.recordAddTransitions(transitions, incident.id, incident.name, actor)
		);
		await bestEffort('dissolving emptied incidents', () => this.dissolveIfEmpty(previousIds));
		const alertIds = transitions.map((t) => t.alertId);
		await bestEffort('claiming unowned members', () => this.alerts.claimUnowned(alertIds, owner));
		this.alerts.invalidateSnapshots();
	}

	// The creator owns the incident (createdBy) and its unowned members.
	async create(request: CreateIncidentRequest, actor: IncidentActor): Promise<IncidentSummary> {
		await this.assertAlertsExist(request.alertIds);
		const { lastID, transitions } = await this.incidentRepo.createIncidentWithAlerts(
			{
				name: request.name?.trim() || null,
				description: request.description?.trim() || null,
				createdBy: actor.id,
			},
			request.alertIds
		);
		const summary = await this.incidentRepo.getIncidentSummaryById(lastID);
		if (!summary) throw new Error(`Incident ${lastID} vanished right after creation`);
		await this.afterMembersAdded(summary, transitions, actor, actor, `Incident ${lastID} was created`);
		return summary;
	}

	// Both reads sweep first: retention (and any other hard-delete path) purges alerts
	// with raw SQL, and reading is the cheap place to keep membership honest afterwards.
	// `get` sweeps too, so an incident opened right after a purge never reports members
	// that no longer exist.
	async list(): Promise<IncidentSummary[]> {
		await this.incidentRepo.pruneDanglingMemberships();
		return this.incidentRepo.getIncidentSummaries();
	}

	async get(id: number): Promise<IncidentSummary | undefined> {
		await this.incidentRepo.pruneDanglingMemberships();
		return this.incidentRepo.getIncidentSummaryById(id);
	}

	async update(id: number, data: UpdateIncidentInput): Promise<Incident | undefined> {
		await this.incidentRepo.updateIncident(id, data);
		return this.incidentRepo.getIncidentById(id);
	}

	// Add alerts to an existing incident. Same ownership rule as create, anchored on the
	// incident's owner rather than whoever adds: unowned newcomers go to the incident's
	// owner (the actor when the incident has none), so the folder stays whole in the
	// split-by-owner view. Alerts already in another incident move over.
	async addAlerts(id: number, alertIds: string[], actor: IncidentActor): Promise<IncidentSummary | undefined> {
		const incident = await this.incidentRepo.getIncidentSummaryById(id);
		if (!incident) return undefined;
		await this.assertAlertsExist(alertIds);
		const { transitions } = await this.incidentRepo.addAlerts(id, alertIds);
		const owner: IncidentActor =
			incident.createdBy !== null ? { id: incident.createdBy, name: incident.ownerName } : actor;
		await this.afterMembersAdded(incident, transitions, actor, owner, `Alerts were added to incident ${id}`);
		return this.incidentRepo.getIncidentSummaryById(id);
	}

	// Removing the last member dissolves the incident: an empty folder can't be seen or
	// managed from the table, so it must not linger. Returns whether it survived.
	async removeAlerts(
		id: number,
		alertIds: string[],
		actor: IncidentActor,
		reason?: string
	): Promise<{ dissolved: boolean } | undefined> {
		const incident = await this.incidentRepo.getIncidentById(id);
		if (!incident) return undefined;
		const { removedAlertIds } = await this.incidentRepo.removeAlerts(id, alertIds);
		await this.recordMembershipEvents(
			removedAlertIds,
			AlertHistoryEventType.INCIDENT_REMOVED,
			incident.name,
			actor,
			reason
		);
		const remaining = await this.incidentRepo.getMemberCount(id);
		if (remaining === 0) {
			await this.incidentRepo.deleteIncident(id);
		}
		this.alerts.invalidateSnapshots();
		return { dissolved: remaining === 0 };
	}

	// Ungroup: incident dies, alerts survive untouched.
	async delete(id: number, actor: IncidentActor): Promise<boolean> {
		const incident = await this.incidentRepo.getIncidentById(id);
		if (!incident) return false;
		const { memberAlertIds } = await this.incidentRepo.deleteIncident(id);
		await this.recordMembershipEvents(memberAlertIds, AlertHistoryEventType.INCIDENT_REMOVED, incident.name, actor);
		this.alerts.invalidateSnapshots();
		return true;
	}

	// Hook for the alert owner path: an alert whose owner is removed leaves its incident.
	// Membership means "someone is handling this as part of the incident"; unassigning
	// says the opposite, and keeping the alert would split the folder between the
	// Unassigned and Assigned panes.
	async handleAlertUnassigned(alertId: string, actor: IncidentActor): Promise<void> {
		const incidentId = await this.incidentRepo.getIncidentIdForAlert(alertId);
		if (incidentId === null) return;
		await this.removeAlerts(incidentId, [alertId], actor);
	}

	// Hook for the ingest path: a resolved alert that fires again is a NEW episode. It
	// leaves the incident it was grouped under (membership follows the id, so it would
	// otherwise snap back in, ownerless) and starts over as a plain alert; the incident
	// keeps its remaining members, and dissolves if that was the last one.
	async handleAlertsRefired(alertIds: string[]): Promise<void> {
		const membership = await this.incidentRepo.getMembershipMap();
		const byIncident = groupByIncident(alertIds, (alertId) => membership.get(alertId));
		for (const [incidentId, members] of byIncident) {
			await this.removeAlerts(incidentId, members, SYSTEM_ACTOR, 'fired again after resolving');
		}
	}

	// Hook for the alerts delete-forever paths: memberships must not dangle after their
	// alert is permanently gone, and incidents this empties dissolve.
	async handleAlertsDeleted(alertIds: string[]): Promise<void> {
		const { affectedIncidentIds } = await this.incidentRepo.removeMembershipForAlerts(alertIds);
		if (affectedIncidentIds.length > 0) {
			await this.dissolveIfEmpty(affectedIncidentIds);
			this.alerts.invalidateSnapshots();
		}
	}
}
