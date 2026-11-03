// How many of a folder's folded members are selected: drives the folder checkbox.
export type IncidentSelectionState = 'none' | 'some' | 'all';

export const INCIDENT_SELECTION_STATE: Record<Uppercase<IncidentSelectionState>, IncidentSelectionState> = {
	NONE: 'none',
	SOME: 'some',
	ALL: 'all',
};

// Accessible names for the folder checkbox; the incident name tells folders apart for
// screen reader users moving between checkboxes.
export const INCIDENT_SELECTION_LABELS: Record<'select' | 'unselect', (incidentName: string) => string> = {
	select: (incidentName) => `Select the alerts of incident "${incidentName}"`,
	unselect: (incidentName) => `Unselect the alerts of incident "${incidentName}"`,
};
