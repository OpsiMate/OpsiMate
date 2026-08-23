import { BucketGranularity } from '@OpsiMate/shared';

// Formatting helpers for the Insights page. Durations are stored in ms and read in
// human units — "2h 14m" beats "8040000ms" on a KPI card.

export const formatDurationMs = (ms: number | null): string => {
	if (ms === null) return '—';
	if (ms < 1000) return '<1s';
	const seconds = Math.round(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ${seconds % 60 ? `${seconds % 60}s` : ''}`.trim();
	const hours = Math.floor(minutes / 60);
	if (hours < 48) return `${hours}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim();
	const days = Math.floor(hours / 24);
	return `${days}d ${hours % 24 ? `${hours % 24}h` : ''}`.trim();
};

export const formatPercent = (rate: number | null): string =>
	rate === null ? '—' : `${(rate * 100).toFixed(rate < 0.095 ? 1 : 0)}%`;

// Relative delta vs the previous period; null when there is no basis to compare.
export const deltaPercent = (value: number, previous: number | null): number | null => {
	if (previous === null || previous === 0) return null;
	return (value - previous) / previous;
};

export interface TimePresetOption {
	key: string;
	label: string;
	// Window length in hours; null = all time.
	hours: number | null;
}

export const TIME_PRESETS: TimePresetOption[] = [
	// "Today" is start-of-local-day to now (its `from` is computed specially, not from
	// `hours`); every other preset is a rolling window of `hours`.
	{ key: 'today', label: 'Today', hours: null },
	{ key: '24h', label: '24h', hours: 24 },
	{ key: '7d', label: '7 days', hours: 7 * 24 },
	{ key: '30d', label: '30 days', hours: 30 * 24 },
	{ key: '90d', label: '90 days', hours: 90 * 24 },
	{ key: 'all', label: 'All time', hours: null },
];

// x-axis tick for a time-series bucket key. Hour buckets ("YYYY-MM-DD HH:00") show just
// the time, except at midnight where the short date marks the day change; day buckets
// ("YYYY-MM-DD") show "MMM D".
export const formatBucketTick = (value: string, granularity: BucketGranularity): string => {
	if (granularity === 'hour') {
		const time = value.slice(11); // "HH:00"
		if (time !== '00:00') return time;
		return new Date(`${value.slice(0, 10)}T00:00`).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
		});
	}
	return new Date(`${value}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Severity palette shared by every chart on the page (CSS-var free: recharts needs
// concrete colors, and these read correctly on both themes).
export const SEVERITY_COLORS: Record<string, string> = {
	critical: '#ef4444',
	warning: '#f59e0b',
	info: '#3b82f6',
};
