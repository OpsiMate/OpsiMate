import { describe, expect, test } from 'vitest';
import { AlertHistoryData, AlertHistoryEventType, AlertStatus } from '@OpsiMate/shared';
import {
	buildHistoryGraph,
	filterHistoryByLane,
	historyEntryLane,
	historyToCsv,
	historyToJson,
} from '@/components/Alerts/AlertDetails/AlertHistoryTimeline/alertHistory.utils';

const entry = (
	eventType: AlertHistoryEventType | undefined,
	overrides: Partial<AlertHistoryData> = {}
): AlertHistoryData => ({ date: '2026-08-18T10:00:00.000Z', eventType, ...overrides }) as AlertHistoryData;

describe('historyEntryLane', () => {
	test('firing/resolved/unresolved are the main branch, user activity the side branch', () => {
		expect(historyEntryLane(entry(AlertHistoryEventType.STATUS_CHANGED))).toBe('lifecycle');
		// Legacy status-only rows have no eventType at all — they are STATUS_CHANGED.
		expect(historyEntryLane(entry(undefined))).toBe('lifecycle');
		expect(historyEntryLane(entry(AlertHistoryEventType.RESOLVED))).toBe('lifecycle');
		expect(historyEntryLane(entry(AlertHistoryEventType.UNRESOLVED))).toBe('lifecycle');
		for (const t of [
			AlertHistoryEventType.COMMENT_ADDED,
			AlertHistoryEventType.SILENCED,
			AlertHistoryEventType.UNSILENCED,
			AlertHistoryEventType.OWNER_ASSIGNED,
			AlertHistoryEventType.OWNER_UNASSIGNED,
			AlertHistoryEventType.ACTION_RUN,
			AlertHistoryEventType.UPDATED,
		]) {
			expect(historyEntryLane(entry(t))).toBe('activity');
		}
	});
});

describe('buildHistoryGraph', () => {
	test('marks side-run boundaries so the timeline can draw branch/merge corners', () => {
		// newest-first: firing, [comment, silence, action], resolved, [comment], firing
		const rows = buildHistoryGraph([
			entry(AlertHistoryEventType.STATUS_CHANGED),
			entry(AlertHistoryEventType.COMMENT_ADDED),
			entry(AlertHistoryEventType.SILENCED),
			entry(AlertHistoryEventType.ACTION_RUN),
			entry(AlertHistoryEventType.STATUS_CHANGED),
			entry(AlertHistoryEventType.COMMENT_ADDED),
			entry(AlertHistoryEventType.STATUS_CHANGED),
		]);
		expect(rows.map((r) => r.lane)).toEqual([
			'lifecycle',
			'activity',
			'activity',
			'activity',
			'lifecycle',
			'activity',
			'lifecycle',
		]);
		// The 3-entry run: newest opens it, oldest closes it, the middle is neither.
		expect(rows[1]).toMatchObject({ sideRunStart: true, sideRunEnd: false });
		expect(rows[2]).toMatchObject({ sideRunStart: false, sideRunEnd: false });
		expect(rows[3]).toMatchObject({ sideRunStart: false, sideRunEnd: true });
		// A lone side entry is a run of one: both boundary flags at once.
		expect(rows[5]).toMatchObject({ sideRunStart: true, sideRunEnd: true });
	});

	test('a history that is all activity is one long run', () => {
		const rows = buildHistoryGraph([
			entry(AlertHistoryEventType.COMMENT_ADDED),
			entry(AlertHistoryEventType.COMMENT_ADDED),
		]);
		expect(rows[0]).toMatchObject({ sideRunStart: true, sideRunEnd: false });
		expect(rows[1]).toMatchObject({ sideRunStart: false, sideRunEnd: true });
	});
});

describe('filterHistoryByLane', () => {
	test('isolates one branch; "all" returns the input untouched', () => {
		const data = [
			entry(AlertHistoryEventType.STATUS_CHANGED),
			entry(AlertHistoryEventType.COMMENT_ADDED),
			entry(AlertHistoryEventType.RESOLVED),
		];
		expect(filterHistoryByLane(data, 'all')).toBe(data);
		expect(filterHistoryByLane(data, 'lifecycle')).toHaveLength(2);
		expect(filterHistoryByLane(data, 'activity')).toHaveLength(1);
	});
});

describe('export serializers', () => {
	const data: AlertHistoryData[] = [
		entry(AlertHistoryEventType.STATUS_CHANGED, { status: AlertStatus.FIRING }),
		entry(AlertHistoryEventType.COMMENT_ADDED, {
			actorName: 'idan',
			description: 'said "hello, world"\nsecond line',
		}),
	];

	test('CSV quotes every field and doubles embedded quotes', () => {
		const csv = historyToCsv(data);
		const lines = csv.split('\n');
		expect(lines[0]).toBe('"date","event","branch","status","actor","description"');
		expect(lines[1]).toContain('"Firing"');
		expect(lines[1]).toContain('"lifecycle"');
		// The embedded quotes are doubled, and the newline stays INSIDE the quoted field.
		expect(csv).toContain('said ""hello, world""');
		expect(csv).toContain('"idan"');
	});

	test('JSON carries the same fields with nulls for absences', () => {
		const parsed = JSON.parse(historyToJson(data)) as Array<Record<string, unknown>>;
		expect(parsed).toHaveLength(2);
		expect(parsed[0]).toMatchObject({ event: 'Firing', branch: 'lifecycle', actor: null });
		expect(parsed[1]).toMatchObject({ event: 'Comment added', branch: 'activity', actor: 'idan' });
	});
});
