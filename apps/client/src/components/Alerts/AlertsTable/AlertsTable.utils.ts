import { UserInfo } from '@/hooks/queries/users';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { getIntegrationLabel, resolveAlertIntegration } from '../IntegrationAvatar';
import { createServiceNameLookup } from '../utils';
import { getAlertTagsString } from '../utils/alertTags.utils';
import { getOwnerDisplayName, getOwnerSortKey } from '../utils/owner.utils';
import { getAlertSeverity, SEVERITY_LABELS, SEVERITY_RANK } from '../utils/severity.utils';
import { AlertSortField, FlatGroupItem, GroupNode, GroupStatus, SortDirection } from './AlertsTable.types';

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

// Comparable value for one alert under a sort field; null means "field not sortable".
const getSortValue = (alert: Alert, sortField: AlertSortField, users: UserInfo[]): string | number | null => {
	if (isTagKeyColumn(sortField)) {
		return getTagKeyValue(alert, sortField).toLowerCase();
	}
	switch (sortField) {
		case 'alertName':
			return alert.alertName.toLowerCase();
		case 'status':
			return alert.isDismissed ? 'dismissed' : alert.isSilenced ? 'silenced' : 'firing';
		case 'severity':
			// Rank-based so desc = critical first, info last.
			return SEVERITY_RANK[getAlertSeverity(alert)];
		case 'summary':
			return (alert.summary || '').toLowerCase();
		case 'startsAt': {
			const date = new Date(alert.startsAt);
			return isNaN(date.getTime()) ? 0 : date.getTime();
		}
		case 'type':
			return getIntegrationLabel(resolveAlertIntegration(alert)).toLowerCase();
		case 'owner':
			return getOwnerSortKey(alert.ownerId, users);
		default:
			return null;
	}
};

export const sortAlerts = (
	alerts: Alert[],
	sortField: AlertSortField,
	sortDirection: SortDirection,
	users: UserInfo[] = []
): Alert[] => {
	return [...alerts].sort((a, b) => {
		const aValue = getSortValue(a, sortField, users);
		const bValue = getSortValue(b, sortField, users);
		if (aValue === null || bValue === null) return 0;

		if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
		if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
		return 0;
	});
};

export const formatDate = (dateString: string): string => {
	const date = new Date(dateString);
	return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString();
};

export const getAlertValue = (alert: Alert, field: string, users: UserInfo[] = []): string => {
	if (isTagKeyColumn(field)) {
		return getTagKeyValue(alert, field) || 'N/A';
	}

	switch (field) {
		case 'alertName':
			return alert.alertName;
		case 'status':
			return alert.isDismissed ? 'Dismissed' : alert.isSilenced ? 'Silenced' : 'Firing';
		case 'severity':
			return SEVERITY_LABELS[getAlertSeverity(alert)];
		case 'summary':
			return alert.summary || 'Unknown';
		case 'startsAt': {
			const date = new Date(alert.startsAt);
			if (isNaN(date.getTime())) return 'Unknown';
			return date.toISOString().split('T')[0];
		}
		case 'type':
			return getIntegrationLabel(resolveAlertIntegration(alert));
		case 'owner':
			return getOwnerDisplayName(alert.ownerId, users);
		default:
			return 'Unknown';
	}
};

export const createTagKeyValueGetter = (_columnLabels: Record<string, string>, users: UserInfo[] = []) => {
	return (alert: Alert, field: string): string => getAlertValue(alert, field, users);
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

const getGroupStatus = (node: GroupNode): GroupStatus => {
	if (node.type === 'leaf') {
		if (node.alert.isDismissed) return 'dismissed';
		if (node.alert.isSilenced) return 'silenced';
		return node.alert.status === 'firing' ? 'firing' : 'resolved';
	}

	let hasFiring = false;
	let hasSilenced = false;
	let hasResolved = false;

	for (const child of node.children) {
		const childStatus = getGroupStatus(child);
		if (childStatus === 'firing') hasFiring = true;
		else if (childStatus === 'silenced') hasSilenced = true;
		else if (childStatus === 'resolved') hasResolved = true;
	}

	if (hasFiring) return 'firing';
	if (hasSilenced) return 'silenced';
	if (hasResolved) return 'resolved';
	return 'dismissed';
};

export const flattenGroups = (nodes: GroupNode[], expandedKeys: Set<string>): FlatGroupItem[] => {
	const result: FlatGroupItem[] = [];

	const traverse = (nodes: GroupNode[]) => {
		for (const node of nodes) {
			if (node.type === 'leaf') {
				result.push({ type: 'leaf', alert: node.alert });
			} else {
				const isExpanded = expandedKeys.has(node.key);
				const groupStatus = getGroupStatus(node);
				result.push({
					type: 'group',
					key: node.key,
					field: node.field,
					value: node.value,
					count: node.count,
					level: node.level,
					isExpanded,
					groupStatus,
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
