import { IncidentSummary } from '@OpsiMate/shared';
import { pluralize } from '@/lib/text';
import { GroupStatus } from '../AlertsTable.types';

// The incident's rolled-up status, by the same precedence group headers use (see
// rollupStatus in @OpsiMate/shared): anything firing makes it firing; otherwise resolved
// members beat silenced ones. An incident has no muted members to roll up.
export const incidentStatus = (incident: IncidentSummary): GroupStatus => {
	if (incident.firingCount > 0) return 'firing';
	if (incident.resolvedCount > 0) return 'resolved';
	return 'silenced';
};

// The split behind the count badge, for its tooltip: "3 firing, 1 silenced, 2 resolved".
export const incidentStatusBreakdown = (incident: IncidentSummary): string => {
	const parts = [
		incident.firingCount > 0 && `${incident.firingCount} firing`,
		incident.silencedCount > 0 && `${incident.silencedCount} silenced`,
		incident.resolvedCount > 0 && `${incident.resolvedCount} resolved`,
	].filter((part): part is string => typeof part === 'string');
	const total = `${incident.alertCount} ${pluralize(incident.alertCount, 'alert')}`;
	return parts.length > 0 ? `${total}: ${parts.join(', ')}` : total;
};
