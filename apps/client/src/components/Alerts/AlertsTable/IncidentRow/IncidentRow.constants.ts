import { MEMBER_SELECTION_STATE, MemberSelectionState } from '../AlertsTable.constants';

// How many of a folder's folded members are selected: drives the folder checkbox (the
// table-wide member selection state, under the folder's own name).
export type IncidentSelectionState = MemberSelectionState;
export const INCIDENT_SELECTION_STATE = MEMBER_SELECTION_STATE;

// Accessible names for the folder checkbox; the incident name tells folders apart for
// screen reader users moving between checkboxes.
export const INCIDENT_SELECTION_LABELS: Record<'select' | 'unselect', (incidentName: string) => string> = {
	select: (incidentName) => `Select the alerts of incident "${incidentName}"`,
	unselect: (incidentName) => `Unselect the alerts of incident "${incidentName}"`,
};

// The buckets named in the count badge's tooltip ("3 alerts: 2 firing, 1 silenced").
export const INCIDENT_STATUS_LABELS: Record<'firing' | 'silenced' | 'resolved', string> = {
	firing: 'firing',
	silenced: 'silenced',
	resolved: 'resolved',
};

// The count badge's accessible name when filters hide some members: the visible
// "shown/total" first, then the full split.
export const INCIDENT_PARTIAL_COUNT_LABEL = (shown: number, total: number, breakdown: string): string =>
	`${shown}/${total} shown, ${breakdown}`;
