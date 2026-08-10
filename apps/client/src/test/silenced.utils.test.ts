import { describe, expect, test } from 'vitest';
import {
	areSilencedAlertsShown,
	SILENCED_STATUS,
	toggleSilencedAlerts,
} from '@/components/Alerts/utils/silenced.utils';

// The toolbar's silenced toggle writes the same status filter the sidebar edits, so the two
// always agree. Round-tripping matters most: whatever the filters look like, one click hides
// silenced alerts and a second click brings them back.

describe('areSilencedAlertsShown', () => {
	test('no status filter shows everything, silenced included', () => {
		expect(areSilencedAlertsShown({})).toBe(true);
		expect(areSilencedAlertsShown({ severity: ['Critical'] })).toBe(true);
	});

	test('an include list decides by membership', () => {
		expect(areSilencedAlertsShown({ status: ['Firing'] })).toBe(false);
		expect(areSilencedAlertsShown({ status: ['Firing', 'Silenced'] })).toBe(true);
	});

	test('an exclusion wins over an include list', () => {
		expect(areSilencedAlertsShown({ status: ['Firing', 'Silenced'], '!status': ['Silenced'] })).toBe(false);
	});

	test('an empty include list is no constraint', () => {
		expect(areSilencedAlertsShown({ status: [] })).toBe(true);
	});
});

describe('toggleSilencedAlerts', () => {
	test('adds Silenced to an include list that omits it', () => {
		expect(toggleSilencedAlerts({ status: ['Firing'] })).toEqual({ status: ['Firing', SILENCED_STATUS] });
	});

	test('drops Silenced from an include list that has other values', () => {
		expect(toggleSilencedAlerts({ status: ['Firing', 'Silenced'] })).toEqual({ status: ['Firing'] });
	});

	test('excludes when there is no include list to narrow', () => {
		expect(toggleSilencedAlerts({})).toEqual({ '!status': [SILENCED_STATUS] });
	});

	// Dropping the only included value would lift the status filter and bring silenced
	// alerts straight back — the toggle has to express this as an exclusion instead.
	test('status: [Silenced] alone becomes an exclusion, not an empty filter', () => {
		expect(toggleSilencedAlerts({ status: ['Silenced'] })).toEqual({ '!status': [SILENCED_STATUS] });
	});

	test('removes an existing exclusion to show them again', () => {
		expect(toggleSilencedAlerts({ '!status': [SILENCED_STATUS] })).toEqual({});
	});

	test('clearing an exclusion also re-adds Silenced to an include list', () => {
		expect(toggleSilencedAlerts({ status: ['Firing'], '!status': [SILENCED_STATUS] })).toEqual({
			status: ['Firing', SILENCED_STATUS],
		});
	});

	test('leaves other fields and other excluded statuses alone', () => {
		expect(toggleSilencedAlerts({ severity: ['Critical'], '!status': ['Muted'] })).toEqual({
			severity: ['Critical'],
			'!status': ['Muted', SILENCED_STATUS],
		});
	});

	test('never duplicates Silenced in the include list', () => {
		const once = toggleSilencedAlerts({ status: ['Firing'], '!status': [SILENCED_STATUS] });
		expect(once.status).toEqual(['Firing', SILENCED_STATUS]);
	});

	test.each([
		[{}],
		[{ status: ['Firing'] }],
		[{ status: ['Firing', 'Silenced'] }],
		[{ status: ['Silenced'] }],
		[{ severity: ['Critical'] }],
		[{ '!status': ['Muted'] }],
	])('two clicks restore what the filters showed: %j', (filters) => {
		const shown = areSilencedAlertsShown(filters);
		const once = toggleSilencedAlerts(filters);
		expect(areSilencedAlertsShown(once)).toBe(!shown);
		expect(areSilencedAlertsShown(toggleSilencedAlerts(once))).toBe(shown);
	});
});
