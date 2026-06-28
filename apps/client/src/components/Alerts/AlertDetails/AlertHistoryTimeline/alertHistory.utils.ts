import { AlertHistoryData } from '@OpsiMate/shared';
import { TimeRange } from '../../AlertsTable/TimeFilter/TimeFilter.types';

// Filters history entries to the active time range. An empty range ("All time") returns
// everything. Mirrors how the alerts list itself is filtered by the time button.
export const filterHistoryByRange = (data: AlertHistoryData[], timeRange?: TimeRange | null): AlertHistoryData[] => {
	if (!timeRange || (!timeRange.from && !timeRange.to)) {
		return data;
	}
	const fromMs = timeRange.from ? timeRange.from.getTime() : null;
	const toMs = timeRange.to ? timeRange.to.getTime() : null;
	return data.filter((item) => {
		const t = new Date(item.date).getTime();
		if (fromMs !== null && t < fromMs) return false;
		if (toMs !== null && t > toMs) return false;
		return true;
	});
};
