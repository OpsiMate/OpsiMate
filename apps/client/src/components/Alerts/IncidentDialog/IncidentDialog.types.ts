import { Alert, IncidentSummary } from '@OpsiMate/shared';

// Grouping `alerts`: into a new incident, or into one of the existing `incidents`.
export interface IncidentCreateTarget {
	alerts: Alert[];
	incidents: IncidentSummary[];
}

// Editing an existing incident's name and details.
export interface IncidentEditTarget {
	incident: IncidentSummary;
}

// What the dialog is for; null means closed.
export type IncidentDialogTarget = IncidentCreateTarget | IncidentEditTarget;

export interface IncidentCreateResult {
	kind: 'create';
	name: string;
	description: string;
}

export interface IncidentAddResult {
	kind: 'add';
	incidentId: number;
}

export interface IncidentEditResult {
	kind: 'edit';
	name: string;
	description: string;
}

// What the user asked for when submitting the form.
export type IncidentFormResult = IncidentCreateResult | IncidentAddResult | IncidentEditResult;
