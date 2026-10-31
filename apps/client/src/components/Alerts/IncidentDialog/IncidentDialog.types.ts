import { Alert, IncidentSummary } from '@OpsiMate/shared';

// Grouping `alerts` into a new incident.
export interface IncidentCreateTarget {
	alerts: Alert[];
}

// Editing an existing incident's name and details.
export interface IncidentEditTarget {
	incident: IncidentSummary;
}

// What the dialog is for; null means closed.
export type IncidentDialogTarget = IncidentCreateTarget | IncidentEditTarget;
