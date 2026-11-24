import { describe, expect, test } from 'vitest';
import { IncidentSummary } from '@OpsiMate/shared';
import { incidentStatus, incidentStatusBreakdown } from '@/components/Alerts/AlertsTable/IncidentRow/IncidentRow.utils';

const incident = (firing: number, silenced: number, resolved: number): IncidentSummary =>
	({
		alertCount: firing + silenced + resolved,
		firingCount: firing,
		silencedCount: silenced,
		resolvedCount: resolved,
	}) as IncidentSummary;

// The folder's count badge takes the colour of the incident's rolled-up status, with the
// same precedence as a group header's.
describe('incidentStatus', () => {
	test('anything firing makes the incident firing', () => {
		expect(incidentStatus(incident(1, 5, 5))).toBe('firing');
	});
	test('otherwise resolved members beat silenced ones; all silenced is silenced', () => {
		expect(incidentStatus(incident(0, 2, 1))).toBe('resolved');
		expect(incidentStatus(incident(0, 3, 0))).toBe('silenced');
	});
});

describe('incidentStatusBreakdown', () => {
	test('names the total and each non-empty bucket', () => {
		expect(incidentStatusBreakdown(incident(3, 1, 2))).toBe('6 alerts: 3 firing, 1 silenced, 2 resolved');
		expect(incidentStatusBreakdown(incident(1, 0, 0))).toBe('1 alert: 1 firing');
		expect(incidentStatusBreakdown(incident(0, 0, 0))).toBe('0 alerts');
	});
});
