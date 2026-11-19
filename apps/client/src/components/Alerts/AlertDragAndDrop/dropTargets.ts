import { Alert, IncidentSummary } from '@OpsiMate/shared';

// What a draggable row carries (useDraggable's `data`).
export interface AlertDragData {
	alert: Alert;
}

// dnd-kit keeps droppables in a map by id, so two with the same id would shadow each
// other. Targets that can render more than once — a folder for an incident spanning
// several group-by segments, each split-view table's "ungrouped" band and background —
// take a `scope` (a useId) that makes each instance its own droppable.
const scoped = (id: string, scope?: string) => (scope ? `${id}:${scope}` : id);

// Droppable ids. Rows and tray chips are plain strings, parsed back here so the page's
// drop handler has one place that decides what a drop means.
export const dropId = {
	incident: (incidentId: number, scope?: string) => scoped(`incident:${incidentId}`, scope),
	alert: (alertId: string) => `alert:${alertId}`,
	trayIncident: (incidentId: number) => `tray:incident:${incidentId}`,
	trayNew: 'tray:new',
	trayRemove: 'tray:remove',
	// Out of the incident: the band that appears above the rows while members are dragged...
	ungrouped: (scope?: string) => scoped('ungrouped', scope),
	// ...and the table's background, so dropping on empty space below the rows works too.
	ungroupedArea: (scope?: string) => scoped('ungrouped-area', scope),
	// The split view's panes: unowned alerts dropped on Assigned are assigned to the
	// dragger; owned alerts dropped on Unassigned are unassigned.
	assignedPane: 'pane:assigned',
	unassignedPane: 'pane:unassigned',
};

const INCIDENT_TARGET = /^(?:tray:)?incident:(\d+)(?::|$)/;
const isUngroupedArea = (id: string) => /^ungrouped-area(?::|$)/.test(id);
const isRemoveTarget = (id: string) => id === dropId.trayRemove || /^ungrouped(?:-area)?(?::|$)/.test(id);

// The table background is a droppable that contains every row and folder, so the
// pointer is always "within" it too. A drop means the most specific thing under the
// pointer: rows, folders and tray chips win; the background only counts on its own.
// (A member dropped back on its own row must stay a no-op, not fall through to the
// background's "out of the incident".)
const isFallbackTarget = (id: string) => isUngroupedArea(id);
// The panes are context rather than fallbacks: they stay in the list, after the row
// under the pointer, so resolveDrop knows where that row sits.
const isContextTarget = (id: string) => id === dropId.assignedPane || id === dropId.unassignedPane;

export const preferSpecificTargets = <T extends { id: string | number }>(collisions: T[]): T[] => {
	const context = collisions.filter((collision) => isContextTarget(String(collision.id)));
	const specific = collisions.filter(
		(collision) => !isFallbackTarget(String(collision.id)) && !isContextTarget(String(collision.id))
	);
	return specific.length > 0 ? [...specific, ...context] : collisions;
};

export const dragId = (alertId: string) => `drag:${alertId}`;

export type DropAction =
	// Add the dragged alerts to an existing incident.
	| { kind: 'add'; incidentId: number }
	// Start a new incident from the dragged alerts (the tray's "New incident" chip only).
	| { kind: 'create'; alerts: Alert[] }
	// Take the dragged members out of their incidents.
	| { kind: 'remove'; alerts: Alert[] }
	// Assign the dragged alerts that have no owner to the current user.
	| { kind: 'assign'; alerts: Alert[] }
	// Take the owner off the dragged alerts that have one.
	| { kind: 'unassign'; alerts: Alert[] };

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

// Where the pointer is, pane-wise: the panes stay in the target list after the row under
// the pointer (see preferSpecificTargets), so a row inside a pane can mean the pane.
interface PaneContext {
	inAssignedPane: boolean;
	inUnassignedPane: boolean;
}

// What a drop means: the first of the targets under the pointer (most specific first,
// see preferSpecificTargets) that has something to do with `dragged`. Null when none
// does — an incident's members dropped back on their own folder, an alert on itself or
// on any other plain alert (that never groups: incidents are made from the selection
// bar or the tray's "New incident" chip), owned alerts on the Assigned pane.
export const resolveDrop = (
	over: string | string[] | null,
	dragged: Alert[],
	alertsById: Map<string, Alert>
): DropAction | null => {
	const overIds = over === null ? [] : Array.isArray(over) ? over : [over];
	const panes: PaneContext = {
		inAssignedPane: overIds.includes(dropId.assignedPane),
		inUnassignedPane: overIds.includes(dropId.unassignedPane),
	};
	for (const overId of overIds) {
		const action = resolveDropOn(overId, dragged, alertsById, panes);
		if (action) return action;
	}
	return null;
};

const assignUnowned = (dragged: Alert[]): DropAction | null => {
	const unowned = dragged.filter((alert) => alert.ownerId == null);
	return unowned.length > 0 ? { kind: 'assign', alerts: unowned } : null;
};

const unassignOwned = (dragged: Alert[]): DropAction | null => {
	const owned = dragged.filter((alert) => alert.ownerId != null);
	return owned.length > 0 ? { kind: 'unassign', alerts: owned } : null;
};

const resolveDropOn = (
	overId: string,
	dragged: Alert[],
	alertsById: Map<string, Alert>,
	panes: PaneContext
): DropAction | null => {
	if (dragged.length === 0) return null;
	const incidentMatch = INCIDENT_TARGET.exec(overId);
	if (incidentMatch) {
		const incidentId = Number(incidentMatch[1]);
		if (dragged.every((alert) => alert.incidentId === incidentId)) return null;
		return { kind: 'add', incidentId };
	}
	if (overId === dropId.trayNew) return { kind: 'create', alerts: dragged };
	if (overId === dropId.assignedPane) return assignUnowned(dragged);
	if (overId === dropId.unassignedPane) return unassignOwned(dragged);
	// The Unassigned pane's own table background: a drop there means the pane, so an
	// owned member is unassigned (which also takes it out of its incident, server-side),
	// not merely removed from the incident with its owner kept.
	if (isUngroupedArea(overId) && panes.inUnassignedPane) {
		const unassign = unassignOwned(dragged);
		if (unassign) return unassign;
	}
	if (isRemoveTarget(overId)) {
		const members = dragged.filter((alert) => alert.incidentId != null);
		return members.length > 0 ? { kind: 'remove', alerts: members } : null;
	}
	if (overId.startsWith('alert:')) {
		const target = alertsById.get(overId.slice('alert:'.length));
		return target ? resolveDropOnAlert(target, dragged, panes) : null;
	}
	return null;
};

// Dropping onto a member of an incident joins that incident (the row stands for its
// folder). Onto a plain alert nothing happens — except inside a pane, whose rows fill it,
// so a drop on one of them was aimed at the pane (the whole pane lights up).
const resolveDropOnAlert = (target: Alert, dragged: Alert[], panes: PaneContext): DropAction | null => {
	if (dragged.some((alert) => alert.id === target.id)) return null;
	if (target.incidentId != null) {
		if (dragged.every((alert) => alert.incidentId === target.incidentId)) return null;
		return { kind: 'add', incidentId: target.incidentId };
	}
	if (panes.inAssignedPane) return assignUnowned(dragged);
	if (panes.inUnassignedPane) return unassignOwned(dragged);
	return null;
};
