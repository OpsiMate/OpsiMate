import { Alert, IncidentSummary } from '@OpsiMate/shared';

// Droppable ids. Rows and tray chips are plain strings, parsed back here so the page's
// drop handler has one place that decides what a drop means.
export const dropId = {
	incident: (incidentId: number) => `incident:${incidentId}`,
	alert: (alertId: string) => `alert:${alertId}`,
	trayIncident: (incidentId: number) => `tray:incident:${incidentId}`,
	trayNew: 'tray:new',
	trayRemove: 'tray:remove',
};

export const dragId = (alertId: string) => `drag:${alertId}`;

export type DropAction =
	// Add the dragged alerts to an existing incident.
	| { kind: 'add'; incidentId: number }
	// Start a new incident from the dragged alerts (plus the alert they were dropped on).
	| { kind: 'create'; alerts: Alert[] }
	// Take the dragged members out of their incidents.
	| { kind: 'remove'; alerts: Alert[] };

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

// What dropping `dragged` on `overId` means, or null when the drop changes nothing
// (dropping an incident's members back on their own folder, an alert on itself).
export const resolveDrop = (
	overId: string | null,
	dragged: Alert[],
	alertsById: Map<string, Alert>
): DropAction | null => {
	if (!overId || dragged.length === 0) return null;
	const incidentMatch = /^(?:tray:)?incident:(\d+)$/.exec(overId);
	if (incidentMatch) {
		const incidentId = Number(incidentMatch[1]);
		if (dragged.every((alert) => alert.incidentId === incidentId)) return null;
		return { kind: 'add', incidentId };
	}
	if (overId === dropId.trayNew) return { kind: 'create', alerts: dragged };
	if (overId === dropId.trayRemove) {
		const members = dragged.filter((alert) => alert.incidentId != null);
		return members.length > 0 ? { kind: 'remove', alerts: members } : null;
	}
	if (overId.startsWith('alert:')) {
		const target = alertsById.get(overId.slice('alert:'.length));
		if (!target || dragged.some((alert) => alert.id === target.id)) return null;
		// Dropping onto a member of an incident joins that incident; onto a plain alert
		// starts a new one with both.
		if (target.incidentId != null) {
			if (dragged.every((alert) => alert.incidentId === target.incidentId)) return null;
			return { kind: 'add', incidentId: target.incidentId };
		}
		return { kind: 'create', alerts: [...dragged, target] };
	}
	return null;
};
