import { describe, expect, test } from 'vitest';
import {
	Alert,
	AlertSeverity,
	AlertStatus,
	computeAlertGroupSummaries,
	getAlertGroupValue,
	groupKeySegment,
	makeDayKeyFn,
} from '@OpsiMate/shared';

const mkAlert = (id: string, overrides: Partial<Alert> = {}): Alert => ({
	id,
	type: 'Grafana',
	status: AlertStatus.FIRING,
	severity: AlertSeverity.WARNING,
	tags: {},
	startsAt: '2026-03-15T20:00:00.000Z',
	updatedAt: '2026-03-15T21:00:00.000Z',
	alertUrl: `https://example.com/${id}`,
	alertName: `Alert ${id}`,
	summary: 'Summary',
	createdAt: '2026-03-15T20:00:00.000Z',
	isSilenced: false,
	isMuted: false,
	...overrides,
});

describe('makeDayKeyFn', () => {
	test('buckets an instant in the requested timezone', () => {
		const timestamp = '2026-03-15T20:00:00.000Z';

		expect(makeDayKeyFn('UTC')(timestamp)).toBe('2026-03-15');
		expect(makeDayKeyFn('Asia/Tokyo')(timestamp)).toBe('2026-03-16');
	});

	test('returns Unknown for an unparseable date', () => {
		expect(makeDayKeyFn('UTC')('not-a-date')).toBe('Unknown');
	});

	test('falls back to the runtime timezone for an invalid zone', () => {
		expect(makeDayKeyFn('Not/AZone')('2026-03-15T20:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('getAlertGroupValue', () => {
	test('uses N/A for missing tag values and the tag value when present', () => {
		expect(getAlertGroupValue(mkAlert('missing-tag'), 'tagKey:env', [])).toBe('N/A');
		expect(getAlertGroupValue(mkAlert('prod-tag', { tags: { env: 'prod' } }), 'tagKey:env', [])).toBe('prod');
	});

	test('uses the established display values for status grouping', () => {
		expect(getAlertGroupValue(mkAlert('silenced', { isSilenced: true }), 'status', [])).toBe('Silenced');
		expect(getAlertGroupValue(mkAlert('muted', { isMuted: true }), 'status', [])).toBe('Muted');
		expect(getAlertGroupValue(mkAlert('firing'), 'status', [])).toBe('Firing');
		// Grouping deliberately treats resolved alerts as Firing for backward compatibility.
		expect(getAlertGroupValue(mkAlert('resolved', { status: AlertStatus.RESOLVED }), 'status', [])).toBe('Firing');
	});

	test('uses fallback values for fix, summary, and unknown fields', () => {
		expect(getAlertGroupValue(mkAlert('no-fix'), 'fix', [])).toBe('No fix type');
		expect(getAlertGroupValue(mkAlert('empty-summary', { summary: '' }), 'summary', [])).toBe('Unknown');
		expect(getAlertGroupValue(mkAlert('missing-summary', { summary: undefined }), 'summary', [])).toBe('Unknown');
		expect(getAlertGroupValue(mkAlert('unknown-field'), 'notAField', [])).toBe('Unknown');
	});

	test('uses the supplied day-key function for startsAt', () => {
		const alert = mkAlert('custom-day');
		const dayKey = (dateString: string) => `custom-day-key:${dateString}`;

		expect(getAlertGroupValue(alert, 'startsAt', [], dayKey)).toBe(`custom-day-key:${alert.startsAt}`);
	});
});

describe('groupKeySegment', () => {
	test('encodes delimiters in values and keeps nested paths unambiguous', () => {
		expect(groupKeySegment('root', 'env:prod')).toBe('root:env%3Aprod');
		expect(groupKeySegment('root:a', 'b')).not.toBe(groupKeySegment('root', 'a:b'));
	});
});

describe('computeAlertGroupSummaries', () => {
	test('returns no groups when groupBy is empty', () => {
		expect(computeAlertGroupSummaries([mkAlert('one')], [], [])).toEqual([]);
	});

	test('sorts groups by value and reports their field, count, and top-level level', () => {
		const alerts = [
			mkAlert('staging', { tags: { env: 'staging' } }),
			mkAlert('prod-1', { tags: { env: 'prod' } }),
			mkAlert('prod-2', { tags: { env: 'prod' } }),
		];

		const groups = computeAlertGroupSummaries(alerts, ['tagKey:env'], []);

		expect(groups.map(({ value, count, field, level }) => ({ value, count, field, level }))).toEqual([
			{ value: 'prod', count: 2, field: 'tagKey:env', level: 0 },
			{ value: 'staging', count: 1, field: 'tagKey:env', level: 0 },
		]);
	});

	test('nests groups under parent keys and child counts add up to the parent', () => {
		const alerts = [
			mkAlert('prod-critical', { tags: { env: 'prod' }, severity: AlertSeverity.CRITICAL }),
			mkAlert('prod-warning-1', { tags: { env: 'prod' }, severity: AlertSeverity.WARNING }),
			mkAlert('prod-warning-2', { tags: { env: 'prod' }, severity: AlertSeverity.WARNING }),
			mkAlert('staging-info', { tags: { env: 'staging' }, severity: AlertSeverity.INFO }),
		];

		const groups = computeAlertGroupSummaries(alerts, ['tagKey:env', 'severity'], []);
		const prod = groups.find((group) => group.value === 'prod')!;

		expect(prod.level).toBe(0);
		expect(prod.field).toBe('tagKey:env');
		expect(prod.children.map(({ value, count, field, level }) => ({ value, count, field, level }))).toEqual([
			{ value: 'Critical', count: 1, field: 'severity', level: 1 },
			{ value: 'Warning', count: 2, field: 'severity', level: 1 },
		]);
		expect(prod.children.every((child) => child.key.startsWith(`${prod.key}:`))).toBe(true);
		expect(prod.children.reduce((sum, child) => sum + child.count, 0)).toBe(prod.count);
	});

	test('rolls up firing, muted, resolved, and all-silenced statuses by precedence', () => {
		const alerts = [
			mkAlert('firing-alert', { tags: { env: 'firing' } }),
			mkAlert('firing-resolved', { tags: { env: 'firing' }, status: AlertStatus.RESOLVED }),
			mkAlert('muted-alert', { tags: { env: 'muted' }, isMuted: true }),
			mkAlert('muted-resolved', { tags: { env: 'muted' }, status: AlertStatus.RESOLVED }),
			mkAlert('resolved-alert', { tags: { env: 'resolved' }, status: AlertStatus.RESOLVED }),
			mkAlert('resolved-silenced', { tags: { env: 'resolved' }, isSilenced: true }),
			mkAlert('silenced-firing', { tags: { env: 'silenced' }, isSilenced: true }),
			mkAlert('silenced-resolved', {
				tags: { env: 'silenced' },
				status: AlertStatus.RESOLVED,
				isSilenced: true,
			}),
		];
		const groups = computeAlertGroupSummaries(alerts, ['tagKey:env'], []);

		expect(Object.fromEntries(groups.map(({ value, status }) => [value, status]))).toEqual({
			firing: 'firing',
			muted: 'muted',
			resolved: 'resolved',
			silenced: 'silenced',
		});
	});

	test('groups alerts with missing or empty tag values under N/A', () => {
		const groups = computeAlertGroupSummaries(
			[mkAlert('missing-env'), mkAlert('empty-env', { tags: { env: '' } })],
			['tagKey:env'],
			[]
		);

		expect(groups.map(({ value, count }) => ({ value, count }))).toEqual([{ value: 'N/A', count: 2 }]);
	});
});
