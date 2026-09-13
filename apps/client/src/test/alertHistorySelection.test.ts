import { describe, expect, it } from 'vitest';
import { AlertHistoryEventType } from '@OpsiMate/shared';
import { filterHistoryByRange, selectHistoryEntries } from '@/components/Alerts/AlertDetails/AlertHistoryTimeline/alertHistory.utils';

const entry = (date: string, eventType: AlertHistoryEventType) => ({ date, eventType });
const range = (from: string, to: string) => ({ from: new Date(from), to: new Date(to), preset: 'custom' as const });

describe('alert history selection', () => {
	it('uses inclusive range boundaries', () => {
		const data = [entry('2026-01-01T00:00:00.000Z', AlertHistoryEventType.STATUS_CHANGED), entry('2026-01-02T00:00:00.000Z', AlertHistoryEventType.RESOLVED), entry('2026-01-03T00:00:00.001Z', AlertHistoryEventType.COMMENT_ADDED)];
		expect(filterHistoryByRange(data, range('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z'))).toHaveLength(2);
		expect(filterHistoryByRange(data, null)).toBe(data);
	});

	it('uses UPDATED as a fallback only when real events are outside the window', () => {
		const updated = entry('2026-01-01T00:00:00.000Z', AlertHistoryEventType.UPDATED);
		const real = entry('2026-01-10T00:00:00.000Z', AlertHistoryEventType.STATUS_CHANGED);
		const data = [updated, real];
		expect(selectHistoryEntries(data, range('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z'))).toEqual([updated]);
		expect(selectHistoryEntries(data, null)).toEqual([real]);
	});
});
