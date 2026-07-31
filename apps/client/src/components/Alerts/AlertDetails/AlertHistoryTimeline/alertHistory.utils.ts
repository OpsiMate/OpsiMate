import { AlertHistoryData } from '@OpsiMate/shared';
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
