export const STATUS_HUES = {
	FIRING: 0,
	PENDING: 45,
	ACKNOWLEDGED: 45,
	DISMISSED: 120,
	RESOLVED: 120,
	SUPPRESSED: 120,
	UNKNOWN: 0,
} as const;

export const STATUS_SATURATION = {
	FIRING: 85,
	PENDING: 90,
	ACKNOWLEDGED: 90,
	DISMISSED: 60,
	RESOLVED: 60,
	SUPPRESSED: 60,
	UNKNOWN: 0,
} as const;

export const RECENCY_BUCKETS = [
	{ maxMinutes: 15, weight: 1.0, label: '0-15m' },
	{ maxMinutes: 60, weight: 0.75, label: '15-60m' },
	{ maxMinutes: 360, weight: 0.5, label: '1-6h' },
	{ maxMinutes: 1440, weight: 0.25, label: '6-24h' },
	{ maxMinutes: Infinity, weight: 0.1, label: '24h+' },
] as const;

export const LIGHTNESS_RANGE = {
	MIN: 30,
	MAX: 60,
} as const;

export const STATUS_LEGEND_COLORS = {
	FIRING: 'hsl(0, 85%, 60%)',
	PENDING_ACK: 'hsl(45, 90%, 60%)',
	DISMISSED: 'hsl(120, 60%, 60%)',
	UNKNOWN: 'hsl(0, 0%, 60%)',
} as const;

export const RECENCY_GRADIENT_STEPS = [
	'hsl(0, 85%, 60%)',
	'hsl(0, 85%, 52%)',
	'hsl(0, 85%, 45%)',
	'hsl(0, 85%, 38%)',
	'hsl(0, 85%, 33%)',
] as const;

export const TREEMAP_STROKE = '#1f2937';
