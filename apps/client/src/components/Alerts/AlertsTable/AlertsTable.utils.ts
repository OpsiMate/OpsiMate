import { UserInfo } from '@/hooks/queries/users';
import { formatDateTime, formatTime, isSameLocalDay } from '@/lib/datetime';
import { Alert, getAlertGroupValue, searchAlerts, sortAlertsBy } from '@OpsiMate/shared';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { AlertSortField, FlatGroupItem, GroupNode, GroupStatus, SortDirection } from './AlertsTable.types';

// Search lives in @OpsiMate/shared (searchAlerts) so a server-side search matches this
// table's semantics field for field.
export const filterAlerts = (alerts: Alert[], searchTerm: string): Alert[] => searchAlerts(alerts, searchTerm);

const getTagKeyValue = (alert: Alert, columnId: string): string => {
	const tagKey = extractTagKeyFromColumnId(columnId);
	if (!tagKey) return '';
	return alert.tags?.[tagKey] || '';
};

// Sorting lives in @OpsiMate/shared (sortAlertsBy) so server-side pages are ordered
// exactly as this table would order them; equal keys tiebreak on id, which keeps row
// order stable across refetches and makes pagination cursors well-defined.
export const sortAlerts = (
	alerts: Alert[],
	sortField: AlertSortField,
	sortDirection: SortDirection,
	users: UserInfo[] = []
): Alert[] => sortAlertsBy(alerts, sortField, sortDirection, users);

// The full date+time, for tooltips and copy-to-clipboard. Returns undefined for an
// unparseable value so callers can fall back to the raw string.
export const formatFullTimestamp = (dateString: string): string | undefined => {
	const formatted = formatDateTime(dateString, '');
	return formatted || undefined;
};

// Today's rows drop the date and show the clock alone, which is what keeps these two
// columns narrow; anything older carries the full date.
export const formatDate = (dateString: string): string => {
	const full = formatDateTime(dateString, '');
	if (!full) return 'Invalid Date';
	return isSameLocalDay(dateString) ? formatTime(dateString) : full;
};

// Grouping values live in @OpsiMate/shared (getAlertGroupValue) so server-computed
// group summaries land on exactly the buckets these rows group into. Default day-key:
// the viewer's local timezone.
export const getAlertValue = (alert: Alert, field: string, users: UserInfo[] = []): string =>
	getAlertGroupValue(alert, field, users);

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
		if (node.alert.isSilenced) return 'silenced';
		if (node.alert.isMuted) return 'muted';
		return node.alert.status === 'firing' ? 'firing' : 'resolved';
	}

	let hasFiring = false;
	let hasMuted = false;
	let hasResolved = false;

	for (const child of node.children) {
		const childStatus = getGroupStatus(child);
		if (childStatus === 'firing') hasFiring = true;
		else if (childStatus === 'muted') hasMuted = true;
		else if (childStatus === 'resolved') hasResolved = true;
	}

	if (hasFiring) return 'firing';
	if (hasMuted) return 'muted';
	if (hasResolved) return 'resolved';
	return 'silenced';
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
