// How many of a folder's folded members are selected: drives the folder checkbox.
export type IncidentSelectionState = 'none' | 'some' | 'all';

export const INCIDENT_SELECTION_STATE: Record<Uppercase<IncidentSelectionState>, IncidentSelectionState> = {
	NONE: 'none',
	SOME: 'some',
	ALL: 'all',
};

export const INCIDENT_SELECTION_LABELS: Record<'select' | 'unselect', string> = {
	select: 'Select incident alerts',
	unselect: 'Unselect incident alerts',
};
