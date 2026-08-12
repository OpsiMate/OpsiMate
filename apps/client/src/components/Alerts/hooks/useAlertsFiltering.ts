import { TimeRange } from '@/context/DashboardContext';
import { useUsers } from '@/hooks/queries/users';
import { Alert, alertMatchesFilters, applyTimeWindow } from '@OpsiMate/shared';
import { useEffect, useMemo, useState } from 'react';
import { resolveTimeRange } from '../AlertsTable/TimeFilter/TimeFilter.utils';

// How often a quick-preset window re-anchors to "now". This is the roll cadence: alert
// refetches keep the same array identity when data is unchanged (react-query structural
// sharing), so without the tick the memo would never re-evaluate the window. 10s keeps
// even the "Last 1 minute" preset reasonably fresh at negligible recompute cost.
const ROLLING_WINDOW_TICK_MS = 10 * 1000;

interface UseAlertsFilteringOptions {
	filters: Record<string, string[]>;
	timeRange?: TimeRange;
}

export const useAlertsFiltering = (
	alerts: Alert[],
	filtersOrOptions: Record<string, string[]> | UseAlertsFilteringOptions
) => {
	const { data: users = [] } = useUsers();

	const { filters, timeRange } = useMemo((): { filters: Record<string, string[]>; timeRange?: TimeRange } => {
		// 'filters' in x can't narrow the union on its own: the legacy shape is an open
		// Record, so TS keeps both arms alive and unions every property access. The casts
		// pin each branch to the shape the guard actually identified. The Array check
		// keeps a legacy record whose filter FIELD is named "filters" (value string[])
		// from being mistaken for the options shape.
		if ('filters' in filtersOrOptions && !Array.isArray(filtersOrOptions.filters)) {
			const options = filtersOrOptions as UseAlertsFilteringOptions;
			return { filters: options.filters, timeRange: options.timeRange };
		}
		return { filters: filtersOrOptions as Record<string, string[]>, timeRange: undefined };
	}, [filtersOrOptions]);

	// Quick presets ("Last 1 hour", "Today") are stored as the preset alone and resolved
	// to concrete dates at filter time, so the window rolls with the clock. The tick
	// guarantees a periodic re-anchor even when no refetch re-renders the page.
	const isRollingPreset = !!timeRange?.preset && timeRange.preset !== 'custom';
	const [tick, setTick] = useState(0);
	useEffect(() => {
		if (!isRollingPreset) return;
		const interval = setInterval(() => setTick((t) => t + 1), ROLLING_WINDOW_TICK_MS);
		return () => clearInterval(interval);
	}, [isRollingPreset]);

	const filteredAlerts = useMemo(() => {
		// Reference the tick so a preset window re-anchors to "now" periodically.
		void tick;
		// The window/filter semantics live in @OpsiMate/shared (applyTimeWindow,
		// alertMatchesFilters) — the same functions the server runs for pushed-down
		// queries, so the two can never disagree about what a filter shows.
		const resolved = timeRange ? resolveTimeRange(timeRange) : { from: null, to: null };
		let result = applyTimeWindow(alerts, {
			from: resolved.from ? resolved.from.toISOString() : null,
			to: resolved.to ? resolved.to.toISOString() : null,
		});
		if (Object.keys(filters).length > 0) {
			result = result.filter((alert) => alertMatchesFilters(alert, filters, users));
		}
		return result;
	}, [alerts, filters, timeRange, users, tick]);

	return filteredAlerts;
};
