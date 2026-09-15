import type { TimeRange as DashboardTimeRange } from '@/context/DashboardContext';
import type { AiFilterResult } from '@OpsiMate/shared';
import type { QuickPreset } from '../AlertsTable/TimeFilter/TimeFilter.types';

const PRESET_MINUTES: Array<[number, QuickPreset]> = [
	[1, 'last1m'],
	[2, 'last2m'],
	[5, 'last5m'],
	[15, 'last15m'],
	[30, 'last30m'],
	[60, 'last1h'],
	[120, 'last2h'],
	[360, 'last6h'],
	[720, 'last12h'],
	[1440, 'last24h'],
	[2880, 'last2d'],
	[4320, 'last3d'],
	[7200, 'last5d'],
	[10080, 'last7d'],
];

const minutesToTimeRange = (minutes: number): DashboardTimeRange => {
	const preset = (PRESET_MINUTES.find(([m]) => minutes <= m) ?? PRESET_MINUTES[PRESET_MINUTES.length - 1])[1];
	return { from: null, to: null, preset };
};

export const aiFilterTimeRange = (result: AiFilterResult): DashboardTimeRange => {
	if (result.lastMinutes === undefined) return { from: null, to: null, preset: null };
	return minutesToTimeRange(result.lastMinutes);
};
