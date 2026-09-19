import { describe, expect, test } from 'vitest';
import { AlertHistoryData, AlertHistoryEventType } from '@OpsiMate/shared';
import { TimeRange } from '@/components/Alerts/AlertsTable/TimeFilter/TimeFilter.types';
import {
	filterHistoryByRange,
	selectHistoryEntries,
} from '@/components/Alerts/AlertDetails/AlertHistoryTimeline/alertHistory.utils';

const entry = (
	date: string,
	eventType: AlertHistoryEventType = AlertHistoryEventType.STATUS_CHANGED
): AlertHistoryData => ({ date, eventType }) as AlertHistoryData;

const range = (from: string | null, to: string | null): TimeRange => ({
	from: from ? new Date(from) : null,
	to: to ? new Date(to) : null,
	preset: 'custom',
});

const FROM = '2026-08-18T10:00:00.000Z';
const TO = '2026-08-18T12:00:00.000Z';

const onFrom = entry(FROM);
const onTo = entry(TO);
const inside = entry('2026-08-18T11:00:00.000Z');
const beforeFrom = entry('2026-08-18T09:59:59.999Z');
const afterTo = entry('2026-08-18T12:00:00.001Z');

describe('filterHistoryByRange', () => {
	test('keeps entries exactly on the from and to bounds', () => {
		expect(filterHistoryByRange([onFrom, inside, onTo], range(FROM, TO))).toEqual([onFrom, inside, onTo]);
	});

	test('drops entries one millisecond outside either bound', () => {
		expect(filterHistoryByRange([beforeFrom, inside, afterTo], range(FROM, TO))).toEqual([inside]);
	});

	test('applies an open-ended range on one side only', () => {
		expect(filterHistoryByRange([beforeFrom, onFrom, afterTo], range(FROM, null))).toEqual([onFrom, afterTo]);
		expect(filterHistoryByRange([beforeFrom, onTo, afterTo], range(null, TO))).toEqual([beforeFrom, onTo]);
	});

	test('returns everything unchanged for an "All time" range', () => {
		const data = [beforeFrom, onFrom, inside, onTo, afterTo];
		expect(filterHistoryByRange(data, null)).toBe(data);
		expect(filterHistoryByRange(data, undefined)).toBe(data);
		expect(filterHistoryByRange(data, { from: null, to: null, preset: null })).toBe(data);
	});
});

describe('selectHistoryEntries', () => {
	const updatedInside = entry('2026-08-18T11:30:00.000Z', AlertHistoryEventType.UPDATED);
	const commentInside = entry('2026-08-18T11:00:00.000Z', AlertHistoryEventType.COMMENT_ADDED);
	const statusBefore = entry('2026-08-18T08:00:00.000Z');
	const commentBefore = entry('2026-08-18T09:00:00.000Z', AlertHistoryEventType.COMMENT_ADDED);

	test('returns only real events when any of them fall inside the window', () => {
		expect(selectHistoryEntries([updatedInside, commentInside, statusBefore], range(FROM, TO))).toEqual([
			commentInside,
		]);
	});

	test('falls back to the synthesized last-update entry when the window hides every real event', () => {
		expect(selectHistoryEntries([updatedInside, statusBefore, commentBefore], range(FROM, TO))).toEqual([
			updatedInside,
		]);
	});

	test('returns nothing when the window hides every real event and the update too', () => {
		const updatedBefore = entry('2026-08-18T09:30:00.000Z', AlertHistoryEventType.UPDATED);
		expect(selectHistoryEntries([updatedBefore, statusBefore], range(FROM, TO))).toEqual([]);
	});

	test('never uses the fallback on "All time", even with no real events', () => {
		expect(selectHistoryEntries([updatedInside, statusBefore, commentBefore], null)).toEqual([
			statusBefore,
			commentBefore,
		]);
		expect(selectHistoryEntries([updatedInside], null)).toEqual([]);
		expect(selectHistoryEntries([updatedInside], undefined)).toEqual([]);
	});

	test('returns real events unchanged when there is no synthesized entry', () => {
		expect(selectHistoryEntries([statusBefore, commentBefore], null)).toEqual([statusBefore, commentBefore]);
		expect(selectHistoryEntries([statusBefore, commentBefore], range(FROM, TO))).toEqual([]);
	});
});
