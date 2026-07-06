import { TagKeyInfo } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';
import { HIDDEN_TAG_KEYS } from '../utils/alertTags.utils';

export { extractTagKeyFromColumnId, getTagKeyColumnId, isTagKeyColumn } from '@/types';
export type { TagKeyInfo };

export const useAlertTagKeys = (alerts: Alert[]): TagKeyInfo[] => {
	return useMemo(() => {
		const tagKeyMap = new Map<string, Set<string>>();

		alerts.forEach((alert) => {
			if (alert.tags && typeof alert.tags === 'object') {
				Object.entries(alert.tags).forEach(([key, value]) => {
					// The severity tag mirrors the first-class severity field; it never
					// surfaces as a tag column, facet, or group-by option.
					if (HIDDEN_TAG_KEYS.has(key)) return;
					if (value) {
						if (!tagKeyMap.has(key)) {
							tagKeyMap.set(key, new Set());
						}
						const valueSet = tagKeyMap.get(key);
						if (valueSet) {
							valueSet.add(value);
						}
					}
				});
			}
		});

		return Array.from(tagKeyMap.entries())
			.map(([key, valuesSet]) => ({
				key,
				label: formatTagKeyLabel(key),
				values: Array.from(valuesSet).sort(),
			}))
			.sort((a, b) => a.label.localeCompare(b.label));
	}, [alerts]);
};

const formatTagKeyLabel = (key: string): string => {
	if (!key) return '';
	return key
		.split(/[-_]/)
		.filter((word) => word.length > 0)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
};
