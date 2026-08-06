import { TimeRange } from '@/context/DashboardContext';
import { useUsers } from '@/hooks/queries/users';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { useEffect, useMemo, useState } from 'react';
import { resolveTimeRange } from '../AlertsTable/TimeFilter/TimeFilter.utils';
import { getOwnerDisplayName } from '../utils/owner.utils';
import { getAlertSeverity, SEVERITY_LABELS } from '../utils/severity.utils';

// How often a quick-preset window re-anchors to "now". This is the roll cadence: alert
// refetches keep the same array identity when data is unchanged (react-query structural
// sharing), so without the tick the memo would never re-evaluate the window. 10s keeps
// even the "Last 1 minute" preset reasonably fresh at negligible recompute cost.
const ROLLING_WINDOW_TICK_MS = 10 * 1000;

const getAlertType = (alert: Alert): string => {
	return alert.type || 'Custom';
};

const capitalizeFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

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
		let result = alerts;

		const resolved = timeRange ? resolveTimeRange(timeRange) : { from: null, to: null };
		if (resolved.from || resolved.to) {
			const filterStart = resolved.from || new Date(0);
			const filterEnd = resolved.to || new Date();

			result = result.filter((alert) => {
				const alertStartDate = new Date(alert.startsAt);
				const alertEndDate = new Date(alert.updatedAt);

				return alertStartDate <= filterEnd && alertEndDate >= filterStart;
			});

			// Inside a time window, "Started At" means when the firing episode CURRENT AS OF
			// the window's end began: the LATEST transition into firing at or before the
			// window closes. An alert that fired at 18:00, resolved at 19:00 and re-fired at
			// 20:00 shows 20:00 — the 18:00 episode ended; showing it would misstate how long
			// the alert has been burning. Transitions after the window's end belong to a
			// later episode and are ignored; an alert that simply kept firing across the
			// window's start keeps its real (pre-window) start.
			result = result.map((alert) => {
				// Numeric (epoch) comparison: startsAt can carry a timezone offset while
				// firingTimes are normalized UTC — lexicographic order would mis-pick
				// across formats.
				const candidates = [alert.startsAt, ...(alert.firingTimes ?? [])]
					.map((iso) => ({ iso, epoch: new Date(iso).getTime() }))
					.filter(({ epoch }) => !isNaN(epoch) && epoch <= filterEnd.getTime());
				if (candidates.length === 0) return alert;
				const episodeStart = candidates.reduce((latest, c) => (c.epoch > latest.epoch ? c : latest));
				return episodeStart.iso === alert.startsAt ? alert : { ...alert, startsAt: episodeStart.iso };
			});
		}

		if (Object.keys(filters).length === 0) return result;

		return result.filter((alert) => {
			for (const [field, values] of Object.entries(filters)) {
				if (values.length === 0) continue;

				if (isTagKeyColumn(field)) {
					const tagKey = extractTagKeyFromColumnId(field);
					if (tagKey) {
						const tagValue = alert.tags?.[tagKey] || '';
						if (!values.includes(tagValue)) {
							return false;
						}
					}
					continue;
				}

				let fieldValue: string;
				switch (field) {
					case 'status':
						fieldValue = alert.isSilenced
							? 'Silenced'
							: alert.isMuted
								? 'Muted'
								: capitalizeFirst(alert.status);
						break;
					case 'severity':
						fieldValue = SEVERITY_LABELS[getAlertSeverity(alert)];
						break;
					case 'type':
						fieldValue = getAlertType(alert);
						break;
					case 'alertName':
						fieldValue = alert.alertName ?? '';
						break;
					case 'owner':
						fieldValue = getOwnerDisplayName(alert.ownerId, users);
						break;
					default:
						continue;
				}

				if (!values.includes(fieldValue)) {
					return false;
				}
			}
			return true;
		});
	}, [alerts, filters, timeRange, users, tick]);

	return filteredAlerts;
};
