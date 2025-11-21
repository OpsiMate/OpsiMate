export const GROUPABLE_COLUMNS = ['tag', 'serviceName', 'status', 'type', 'alertName'];

export const AUTO_REFRESH_INTERVAL_MS = 30000;

export type CardSize = 'large' | 'medium' | 'small' | 'extra-small';

export const CARD_SIZE_THRESHOLDS = {
	large: 6,
	medium: 12,
	small: 48,
} as const;

export const GRID_CLASSES: Record<CardSize, string> = {
	large: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
	medium: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3',
	small: 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2',
	'extra-small': 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1',
};
