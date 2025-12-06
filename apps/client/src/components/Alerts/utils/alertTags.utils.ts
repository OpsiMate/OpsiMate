import { Alert } from '@OpsiMate/shared';

export const getAlertTagsArray = (alert: Alert): string[] => {
	if (!alert.tags || typeof alert.tags !== 'object') return [];
	return Object.values(alert.tags).filter(Boolean);
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
		.filter(([, value]) => Boolean(value))
		.map(([key, value]) => ({ key, value }));
};

