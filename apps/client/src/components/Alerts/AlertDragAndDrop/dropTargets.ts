import { Alert, IncidentSummary } from '@OpsiMate/shared';

// Droppable ids. Rows and tray chips are plain strings, parsed back here so the page's
// drop handler has one place that decides what a drop means.
export const dropId = {
	incident: (incidentId: number) => `incident:${incidentId}`,
	alert: (alertId: string) => `alert:${alertId}`,
	trayIncident: (incidentId: number) => `tray:incident:${incidentId}`,
	trayNew: 'tray:new',
	trayRemove: 'tray:remove',
	// Out of the incident: the band that appears above the rows while members are dragged...
	ungrouped: 'ungrouped',
	// ...and the table's background, so dropping on empty space below the rows works too.
	ungroupedArea: 'ungrouped-area',
	// The split view's Assigned pane: unowned alerts dropped there are assigned to the dragger.
	assignedPane: 'pane:assigned',
};

// The table background is a droppable that contains every row and folder, so the
// pointer is always "within" it too. A drop means the most specific thing under the
// pointer: rows, folders and tray chips win; the background only counts on its own.
// (A member dropped back on its own row must stay a no-op, not fall through to the
// background's "out of the incident".)
const FALLBACK_TARGETS = new Set<string>([dropId.ungroupedArea]);
// The Assigned pane is context rather than a fallback: it stays in the list, after the
// row under the pointer, so resolveDrop knows where that row sits.
const CONTEXT_TARGETS = new Set<string>([dropId.assignedPane]);

export const preferSpecificTargets = <T extends { id: string | number }>(collisions: T[]): T[] => {
	const context = collisions.filter((collision) => CONTEXT_TARGETS.has(String(collision.id)));
	const specific = collisions.filter(
		(collision) => !FALLBACK_TARGETS.has(String(collision.id)) && !CONTEXT_TARGETS.has(String(collision.id))
	);
	return specific.length > 0 ? [...specific, ...context] : collisions;
};

export const dragId = (alertId: string) => `drag:${alertId}`;

export type DropAction =
	// Add the dragged alerts to an existing incident.
	| { kind: 'add'; incidentId: number }
	// Start a new incident from the dragged alerts (plus the alert they were dropped on).
	| { kind: 'create'; alerts: Alert[] }
	// Take the dragged members out of their incidents.
	| { kind: 'remove'; alerts: Alert[] }
	// Assign the dragged alerts that have no owner to the current user.
	| { kind: 'assign'; alerts: Alert[] };

// Incidents that would dissolve if `alerts` moved: every member they have is in the set.
// `except` is the destination, which only gains members.
export const incidentsDissolvedBy = (
	alerts: Alert[],
	incidents: IncidentSummary[],
	except: number | null = null
): IncidentSummary[] => {
	const ids = new Set(alerts.map((alert) => alert.id));
	return incidents.filter(
		(incident) =>
			incident.id !== except && incident.alertIds.length > 0 && incident.alertIds.every((id) => ids.has(id))
	);
};

// What a drop means: the first of the targets under the pointer (most specific first,
// see preferSpecificTargets) that has something to do with `dragged`. Null when none
// does — an incident's members dropped back on their own folder, an alert on itself,
// owned alerts on the Assigned pane.
export const resolveDrop = (
	over: string | string[] | null,
	dragged: Alert[],
	alertsById: Map<string, Alert>
): DropAction | null => {
	const overIds = over === null ? [] : Array.isArray(over) ? over : [over];
	const inAssignedPane = overIds.includes(dropId.assignedPane);
	for (const overId of overIds) {
		const action = resolveDropOn(overId, dragged, alertsById, inAssignedPane);
		if (action) return action;
	}
	return null;
};

const assignUnowned = (dragged: Alert[]): DropAction | null => {
	const unowned = dragged.filter((alert) => alert.ownerId == null);
	return unowned.length > 0 ? { kind: 'assign', alerts: unowned } : null;
};

const resolveDropOn = (
	overId: string,
	dragged: Alert[],
	alertsById: Map<string, Alert>,
	inAssignedPane: boolean
): DropAction | null => {
	if (dragged.length === 0) return null;
	const incidentMatch = /^(?:tray:)?incident:(\d+)$/.exec(overId);
	if (incidentMatch) {
		const incidentId = Number(incidentMatch[1]);
		if (dragged.every((alert) => alert.incidentId === incidentId)) return null;
		return { kind: 'add', incidentId };
	}
	if (overId === dropId.trayNew) return { kind: 'create', alerts: dragged };
	if (overId === dropId.assignedPane) return assignUnowned(dragged);
	if (overId === dropId.trayRemove || overId === dropId.ungrouped || overId === dropId.ungroupedArea) {
		const members = dragged.filter((alert) => alert.incidentId != null);
		return members.length > 0 ? { kind: 'remove', alerts: members } : null;
	}
	if (overId.startsWith('alert:')) {
		const target = alertsById.get(overId.slice('alert:'.length));
		return target ? resolveDropOnAlert(target, dragged, inAssignedPane) : null;
	}
	return null;
};

// Dropping onto a member of an incident joins that incident; onto a plain alert starts a
// new one with both.
const resolveDropOnAlert = (target: Alert, dragged: Alert[], inAssignedPane: boolean): DropAction | null => {
	if (dragged.some((alert) => alert.id === target.id)) return null;
	if (target.incidentId != null) {
		if (dragged.every((alert) => alert.incidentId === target.incidentId)) return null;
		return { kind: 'add', incidentId: target.incidentId };
	}
	// The Assigned pane's rows fill it, so unowned alerts landing on one of them were
	// aimed at the pane (the whole pane lights up), not at that row.
	if (inAssignedPane) {
		const assign = assignUnowned(dragged);
		if (assign) return assign;
	}
	return { kind: 'create', alerts: [...dragged, target] };
};
