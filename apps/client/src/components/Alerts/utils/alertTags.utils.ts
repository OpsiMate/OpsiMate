import { Alert } from '@OpsiMate/shared';

// Tags kept out of every tag UI (labels section, tag columns, facets, TV cards). The
// severity tag is an internal mirror of the first-class severity field — users interact
// with severity through the dedicated column/filter/badges, never the raw tag.
export const HIDDEN_TAG_KEYS = new Set(['severity']);

export const getAlertTagsArray = (alert: Alert): string[] => {
	if (!alert.tags || typeof alert.tags !== 'object') return [];
	return Object.entries(alert.tags)
		.filter(([key, value]) => !HIDDEN_TAG_KEYS.has(key) && Boolean(value))
		.map(([, value]) => value);
};

export const getAlertTagsString = (alert: Alert): string => {
	const tags = getAlertTagsArray(alert);
	return tags.join(', ') || '';
};

export const getAlertPrimaryTag = (alert: Alert): string | undefined => {
	const tags = getAlertTagsArray(alert);
	return tags[0];
};

export const hasAlertTags = (alert: Alert): boolean => {
	return getAlertTagsArray(alert).length > 0;
};

export const alertMatchesTagFilter = (alert: Alert, filterValues: string[]): boolean => {
	if (filterValues.length === 0) return true;
	const tags = getAlertTagsArray(alert);
	return tags.some((tag) => filterValues.includes(tag));
};

export const getAlertTagEntries = (alert: Alert): Array<{ key: string; value: string }> => {
	if (!alert.tags || typeof alert.tags !== 'object') return [];
	return Object.entries(alert.tags)
		.filter(([key, value]) => !HIDDEN_TAG_KEYS.has(key) && Boolean(value))
		.map(([key, value]) => ({ key, value }));
};
