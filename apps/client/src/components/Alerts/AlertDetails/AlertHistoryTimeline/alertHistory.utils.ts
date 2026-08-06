import { AlertHistoryData, AlertHistoryEventType } from '@OpsiMate/shared';
import { TimeRange } from '../../AlertsTable/TimeFilter/TimeFilter.types';
import { resolveTimeRange } from '../../AlertsTable/TimeFilter/TimeFilter.utils';

// Filters history entries to the active time range. An empty range ("All time") returns
// everything. Mirrors how the alerts list itself is filtered by the time button —
// including quick presets, which resolve to a fresh window at call time.
export const filterHistoryByRange = (data: AlertHistoryData[], timeRange?: TimeRange | null): AlertHistoryData[] => {
	if (!timeRange) {
		return data;
	}
	const resolved = resolveTimeRange(timeRange);
	if (!resolved.from && !resolved.to) {
		return data;
	}
	const fromMs = resolved.from ? resolved.from.getTime() : null;
	const toMs = resolved.to ? resolved.to.getTime() : null;
	return data.filter((item) => {
		const t = new Date(item.date).getTime();
		if (fromMs !== null && t < fromMs) return false;
		if (toMs !== null && t > toMs) return false;
		return true;
	});
};

// Entries the timeline should show for the active window. Real events (transitions,
// silences, comments…) always win; the synthesized last-update entry is a FALLBACK: it
// steps in only when the window hides every real event — the case where the alert is
// listed because of a recent update but all its history predates the window. On "All
// time" (or any window containing real events) it stays out of the log entirely.
export const selectHistoryEntries = (data: AlertHistoryData[], timeRange?: TimeRange | null): AlertHistoryData[] => {
	const realEntries = data.filter((entry) => entry.eventType !== AlertHistoryEventType.UPDATED);
	const filteredReal = filterHistoryByRange(realEntries, timeRange);
	if (filteredReal.length > 0 || realEntries.length === data.length) {
		return filteredReal;
	}
	const updatedEntries = data.filter((entry) => entry.eventType === AlertHistoryEventType.UPDATED);
	return filterHistoryByRange(updatedEntries, timeRange);
};
