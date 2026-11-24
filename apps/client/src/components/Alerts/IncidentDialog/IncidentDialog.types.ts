import { Alert, IncidentSummary } from '@OpsiMate/shared';

// Open the form on "Existing" with this incident chosen (a drop on it that needs the
// dialog's dissolve warning first).
export interface IncidentExistingPreset {
	destination: 'existing';
	incidentId: number;
}

// Open the form on "Remove" (a drop on a remove target that needs the warning first).
export interface IncidentRemovePreset {
	destination: 'remove';
}

export type IncidentDialogPreset = IncidentExistingPreset | IncidentRemovePreset;

// Grouping `alerts`: into a new incident, or into one of the existing `incidents`.
export interface IncidentCreateTarget {
	alerts: Alert[];
	incidents: IncidentSummary[];
	// Until the incidents list has loaded, the form cannot offer existing incidents nor
	// warn which ones a move would dissolve, so it holds off on submitting.
	incidentsState: 'loading' | 'error' | 'ready';
	// Where the form starts; "New" when absent.
	preset?: IncidentDialogPreset;
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

// Take every selected alert that is in an incident out of it.
export interface IncidentRemoveResult {
	kind: 'remove';
}

export interface IncidentEditResult {
	kind: 'edit';
	name: string;
	description: string;
}

// What the user asked for when submitting the form.
export type IncidentFormResult = IncidentCreateResult | IncidentAddResult | IncidentRemoveResult | IncidentEditResult;
