import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	Alert,
	AlertListFilters,
	AlertStatus,
	AlertSeverity,
	applyTimeWindow,
	alertMatchesFilters,
	getAlertFilterFieldValue,
} from '@OpsiMate/shared';

// New objects per case are important: the shared query engine memoizes field values.
const makeAlert = (overrides: Partial<Alert> = {}): Alert => ({
	id: 'test-alert',
	type: 'Custom',
	status: AlertStatus.FIRING,
	severity: AlertSeverity.WARNING,
	createdAt: '2026-10-01T10:00:00.000Z',
	tags: {},
	startsAt: '2026-10-01T10:00:00.000Z',
	updatedAt: '2026-10-01T20:00:00.000Z',
	alertUrl: '',
	alertName: 'CPU high',
	isSilenced: false,
	isMuted: false,
	...overrides,
});

interface FieldCase {
	name: string;
	overrides: Partial<Alert>;
	field: string;
	expected: string | null;
}
interface FilterCase {
	name: string;
	overrides: Partial<Alert>;
	filters: AlertListFilters;
	expected: boolean;
}

const from = '2026-10-01T12:00:00.000Z';
const to = '2026-10-01T18:00:00.000Z';
afterEach(() => vi.useRealTimers());

describe('applyTimeWindow', () => {
	test('without bounds preserves the array and alert references', () => {
		const alerts = [makeAlert()];
		expect(applyTimeWindow(alerts, { from: null, to: null })).toBe(alerts);
	});

	test('from-only drops expired spans and uses the current time as the end', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(to));
		const expired = makeAlert({ updatedAt: '2026-10-01T11:59:59.999Z' });
		const boundary = makeAlert({ updatedAt: from });
		const future = makeAlert({ startsAt: '2026-10-01T18:00:00.001Z' });
		expect(applyTimeWindow([expired, boundary, future], { from, to: null })).toEqual([boundary]);
	});

	test('to-only drops future spans and defaults the start to the epoch', () => {
		const endedBeforeEpoch = makeAlert({ startsAt: '1969-12-30T00:00:00Z', updatedAt: '1969-12-31T23:59:59Z' });
		const atEnd = makeAlert({ startsAt: to });
		const future = makeAlert({ startsAt: '2026-10-01T18:00:00.001Z' });
		expect(applyTimeWindow([endedBeforeEpoch, atEnd, future], { from: null, to })).toEqual([atEnd]);
	});

	test('chooses the latest eligible firing episode even when candidates are unsorted', () => {
		const alert = makeAlert({
			firingTimes: ['2026-10-01T19:00:00Z', '2026-10-01T17:00:00Z', '2026-10-01T13:00:00Z'],
		});
		const [result] = applyTimeWindow([alert], { from, to });
		expect(result.startsAt).toBe('2026-10-01T17:00:00Z');
		expect(result).not.toBe(alert);
		expect(alert.startsAt).toBe('2026-10-01T10:00:00.000Z');
	});

	test('keeps the original object when startsAt is already the latest candidate', () => {
		const alert = makeAlert({
			startsAt: '2026-10-01T17:00:00Z',
			firingTimes: ['2026-10-01T13:00:00Z', '2026-10-01T19:00:00Z'],
		});
		expect(applyTimeWindow([alert], { from, to })[0]).toBe(alert);
	});

	test('ignores invalid dates and accepts a firing exactly at the end', () => {
		const alert = makeAlert({ firingTimes: ['not-a-date', to, '2026-10-01T18:00:00.001Z'] });
		expect(applyTimeWindow([alert], { from, to })[0].startsAt).toBe(to);
	});

	test('compares epochs rather than lexicographic timezone representations', () => {
		const alert = makeAlert({ startsAt: '2026-10-01T17:00:00+02:00', firingTimes: ['2026-10-01T16:00:00Z'] });
		expect(applyTimeWindow([alert], { from, to })[0].startsAt).toBe('2026-10-01T16:00:00Z');
	});

	test('leaves an alert with no firingTimes unchanged', () => {
		const alert = makeAlert();
		expect(applyTimeWindow([alert], { from, to })[0]).toBe(alert);
	});
});

const fieldCases: FieldCase[] = [
	{
		name: 'silenced wins over muted',
		overrides: { isSilenced: true, isMuted: true },
		field: 'status',
		expected: 'Silenced',
	},
	{ name: 'muted wins over raw status', overrides: { isMuted: true }, field: 'status', expected: 'Muted' },
	{ name: 'firing capitalization', overrides: {}, field: 'status', expected: 'Firing' },
	{
		name: 'resolved capitalization',
		overrides: { status: AlertStatus.RESOLVED },
		field: 'status',
		expected: 'Resolved',
	},
	{ name: 'present tag', overrides: { tags: { env: 'prod' } }, field: 'tagKey:env', expected: 'prod' },
	{ name: 'missing tag', overrides: {}, field: 'tagKey:env', expected: '' },
	{ name: 'missing name', overrides: { alertName: undefined }, field: 'alertName', expected: '' },
	{ name: 'unknown field', overrides: {}, field: 'not-a-field', expected: null },
];
describe('getAlertFilterFieldValue', () => {
	test.each(fieldCases)('$name', ({ overrides, field, expected }) => {
		expect(getAlertFilterFieldValue(makeAlert(overrides), field, [])).toBe(expected);
	});
});

const filterCases: FilterCase[] = [
	{ name: 'empty filters', overrides: {}, filters: {}, expected: true },
	{ name: 'empty accepted values ignored', overrides: {}, filters: { status: [] }, expected: true },
	{ name: 'include firing', overrides: {}, filters: { status: ['Firing'] }, expected: true },
	{
		name: 'include excludes silenced',
		overrides: { isSilenced: true },
		filters: { status: ['Firing'] },
		expected: false,
	},
	{
		name: 'exclude silenced',
		overrides: { isSilenced: true },
		filters: { '!status': ['Silenced'] },
		expected: false,
	},
	{ name: 'exclude allows firing', overrides: {}, filters: { '!status': ['Silenced'] }, expected: true },
	{
		name: 'all filters must pass',
		overrides: { tags: { env: 'prod' } },
		filters: { status: ['Firing'], 'tagKey:env': ['prod'] },
		expected: true,
	},
	{
		name: 'one mismatch rejects',
		overrides: { tags: { env: 'staging' } },
		filters: { status: ['Firing'], 'tagKey:env': ['prod'] },
		expected: false,
	},
	{ name: 'unknown include does not disqualify', overrides: {}, filters: { unknown: ['anything'] }, expected: true },
	{
		name: 'unknown exclude does not disqualify',
		overrides: {},
		filters: { '!unknown': ['anything'] },
		expected: true,
	},
	{ name: 'empty tag value matches missing tag', overrides: {}, filters: { 'tagKey:env': [''] }, expected: true },
	{
		name: 'empty tag value rejects present tag',
		overrides: { tags: { env: 'prod' } },
		filters: { 'tagKey:env': [''] },
		expected: false,
	},
];
describe('alertMatchesFilters', () => {
	test.each(filterCases)('$name', ({ overrides, filters, expected }) => {
		expect(alertMatchesFilters(makeAlert(overrides), filters, [])).toBe(expected);
	});
});
