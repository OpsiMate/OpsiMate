import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { getIntegrationLabel, resolveAlertIntegration } from '../IntegrationAvatar';
import { createServiceNameLookup } from '../utils';
import { getAlertTagsString } from '../utils/alertTags.utils';
import { AlertSortField, FlatGroupItem, GroupNode, SortDirection } from './AlertsTable.types';

export { createServiceNameLookup };

export const filterAlerts = (alerts: Alert[], searchTerm: string): Alert[] => {
	if (!searchTerm.trim()) return alerts;

	const lower = searchTerm.toLowerCase();
	return alerts.filter((alert) => {
		const integration = resolveAlertIntegration(alert);
		const integrationLabel = getIntegrationLabel(integration).toLowerCase();
		const tagsString = getAlertTagsString(alert).toLowerCase();
		return (
			(alert.alertName && alert.alertName.toLowerCase().includes(lower)) ||
			(alert.status && alert.status.toLowerCase().includes(lower)) ||
			tagsString.includes(lower) ||
			(alert.summary && alert.summary.toLowerCase().includes(lower)) ||
			integrationLabel.includes(lower)
		);
	});
};

const getTagKeyValue = (alert: Alert, columnId: string): string => {
	const tagKey = extractTagKeyFromColumnId(columnId);
	if (!tagKey) return '';
	return alert.tags?.[tagKey] || '';
};

export const sortAlerts = (alerts: Alert[], sortField: AlertSortField, sortDirection: SortDirection): Alert[] => {
	return [...alerts].sort((a, b) => {
		let aValue: string | number;
		let bValue: string | number;

		if (isTagKeyColumn(sortField)) {
			aValue = getTagKeyValue(a, sortField).toLowerCase();
			bValue = getTagKeyValue(b, sortField).toLowerCase();
		} else {
			switch (sortField) {
				case 'alertName':
					aValue = a.alertName.toLowerCase();
					bValue = b.alertName.toLowerCase();
					break;
				case 'status':
					aValue = a.isDismissed ? 'dismissed' : 'firing';
					bValue = b.isDismissed ? 'dismissed' : 'firing';
					break;
				case 'summary':
					aValue = (a.summary || '').toLowerCase();
					bValue = (b.summary || '').toLowerCase();
					break;
				case 'startsAt': {
					const aDate = new Date(a.startsAt);
					const bDate = new Date(b.startsAt);
					aValue = isNaN(aDate.getTime()) ? 0 : aDate.getTime();
					bValue = isNaN(bDate.getTime()) ? 0 : bDate.getTime();
					break;
				}
				case 'type':
					aValue = getIntegrationLabel(resolveAlertIntegration(a)).toLowerCase();
					bValue = getIntegrationLabel(resolveAlertIntegration(b)).toLowerCase();
					break;
				default:
					return 0;
			}
		}

		if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
		if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
		return 0;
	});
};

export const formatDate = (dateString: string): string => {
	const date = new Date(dateString);
	return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString();
};

export const getAlertValue = (alert: Alert, field: string): string => {
	if (isTagKeyColumn(field)) {
		return getTagKeyValue(alert, field) || 'N/A';
	}

	switch (field) {
		case 'alertName':
			return alert.alertName;
		case 'status':
			return alert.isDismissed ? 'Dismissed' : 'Firing';
		case 'summary':
			return alert.summary || 'Unknown';
		case 'startsAt': {
			const date = new Date(alert.startsAt);
			if (isNaN(date.getTime())) return 'Unknown';
			return date.toISOString().split('T')[0];
		}
		case 'type':
			return getIntegrationLabel(resolveAlertIntegration(alert));
		default:
			return 'Unknown';
	}
};

export const createTagKeyValueGetter = (_columnLabels: Record<string, string>) => {
	return (alert: Alert, field: string): string => getAlertValue(alert, field);
};

interface GroupAlertsRecursiveOptions {
	alerts: Alert[];
	groupBy: string[];
	level: number;
	parentKey: string;
	valueGetter: (alert: Alert, field: string) => string;
}

const groupAlertsRecursive = (options: GroupAlertsRecursiveOptions): GroupNode[] => {
	const { alerts, groupBy, level, parentKey, valueGetter } = options;

	if (groupBy.length === 0) {
		return alerts.map((alert) => ({ type: 'leaf', alert }));
	}
	const [currentField, ...restFields] = groupBy;
	const groups: Record<string, Alert[]> = {};

	alerts.forEach((alert) => {
		const value = valueGetter(alert, currentField);
		if (!groups[value]) {
			groups[value] = [];
		}
		groups[value].push(alert);
	});

	const sortedKeys = Object.keys(groups).sort();

	return sortedKeys.map((value) => {
		const groupKey = `${parentKey}:${value}`;
		const groupAlertsList = groups[value];
		const children = groupAlertsRecursive({
			alerts: groupAlertsList,
			groupBy: restFields,
			level: level + 1,
			parentKey: groupKey,
			valueGetter,
		});

		return {
			type: 'group',
			key: groupKey,
			field: currentField,
			value,
			count: groupAlertsList.length,
			children,
			level,
		};
	});
};

export const groupAlerts = (
	alerts: Alert[],
	groupBy: string[],
	customValueGetter?: (alert: Alert, field: string) => string
): GroupNode[] => {
	const getter = customValueGetter || getAlertValue;
	return groupAlertsRecursive({
		alerts,
		groupBy,
		level: 0,
		parentKey: 'root',
		valueGetter: getter,
	});
};

export const flattenGroups = (nodes: GroupNode[], expandedKeys: Set<string>): FlatGroupItem[] => {
	const result: FlatGroupItem[] = [];

	const traverse = (nodes: GroupNode[]) => {
		for (const node of nodes) {
			if (node.type === 'leaf') {
				result.push({ type: 'leaf', alert: node.alert });
			} else {
				const isExpanded = expandedKeys.has(node.key);
				result.push({
					type: 'group',
					key: node.key,
					field: node.field,
					value: node.value,
					count: node.count,
					level: node.level,
					isExpanded,
				});

				if (isExpanded) {
					traverse(node.children);
				}
			}
		}
	};

	traverse(nodes);
	return result;
};
