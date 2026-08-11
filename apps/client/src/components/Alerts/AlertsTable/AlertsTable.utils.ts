import { UserInfo } from '@/hooks/queries/users';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { getIntegrationLabel, resolveAlertIntegration } from '../IntegrationAvatar';
import { getAlertTagsString } from '../utils/alertTags.utils';
import { getOwnerDisplayName, getOwnerSortKey } from '../utils/owner.utils';
import { getAlertFix, FIX_LABELS, FIX_RANK } from '../utils/fix.utils';
import { getAlertSeverity, SEVERITY_LABELS, SEVERITY_RANK } from '../utils/severity.utils';
import { AlertSortField, FlatGroupItem, GroupNode, GroupStatus, SortDirection } from './AlertsTable.types';

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
			(alert.lastComment && alert.lastComment.toLowerCase().includes(lower)) ||
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
			return alert.isSilenced ? 'silenced' : alert.isMuted ? 'muted' : 'firing';
		case 'severity':
			// Rank-based so desc = critical first, info last.
			return SEVERITY_RANK[getAlertSeverity(alert)];
		case 'fix': {
			// Rank-based so desc = manual first; unclassified alerts sink to rank 0.
			const fix = getAlertFix(alert);
			return fix ? FIX_RANK[fix] : 0;
		}
		case 'summary':
			return (alert.summary || '').toLowerCase();
		case 'lastComment':
			return (alert.lastComment || '').toLowerCase();
		case 'startsAt': {
			const date = new Date(alert.startsAt);
			return isNaN(date.getTime()) ? 0 : date.getTime();
		}
		case 'updatedAt': {
			const date = new Date(alert.updatedAt);
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

// Timestamps from today render time-only — the date part is noise for the rows users
// care about most; older timestamps keep the full date. Sorting is unaffected: it runs
// on the raw epoch value (getSortValue), never on this display string.
// Grouping key for time columns: the LOCAL calendar day (YYYY-MM-DD), matching the
// local time the cells render (formatDate). A UTC day key could disagree with the
// displayed date near timezone boundaries.
const toLocalDayKey = (dateString: string): string => {
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return 'Unknown';
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
};

// 24-hour clock everywhere: an AM/PM suffix costs horizontal space in the table and a
// beat of reading time on a fast-moving alert list. hourCycle 'h23' (not hour12: false)
// is what keeps midnight at 00:00 — some locales render h24 and print it as 24:00.
const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: 'h23',
};

// Date part stays locale-ordered (the viewer's own d/m/y vs m/d/y), only the clock is pinned.
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	...TIME_OPTIONS,
};

// The full date+time, for tooltips and copy-to-clipboard. Returns undefined for an
// unparseable value so callers can fall back to the raw string.
export const formatFullTimestamp = (dateString: string): string | undefined => {
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return undefined;
	return date.toLocaleString(undefined, DATE_TIME_OPTIONS);
};

export const formatDate = (dateString: string): string => {
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return 'Invalid Date';
	const now = new Date();
	const isToday =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();
	return isToday
		? date.toLocaleTimeString(undefined, TIME_OPTIONS)
		: date.toLocaleString(undefined, DATE_TIME_OPTIONS);
};

export const getAlertValue = (alert: Alert, field: string, users: UserInfo[] = []): string => {
	if (isTagKeyColumn(field)) {
		return getTagKeyValue(alert, field) || 'N/A';
	}

	switch (field) {
		case 'alertName':
			return alert.alertName;
		case 'status':
			return alert.isSilenced ? 'Silenced' : alert.isMuted ? 'Muted' : 'Firing';
		case 'severity':
			return SEVERITY_LABELS[getAlertSeverity(alert)];
		case 'fix': {
			const fix = getAlertFix(alert);
			return fix ? FIX_LABELS[fix] : 'No fix type';
		}
		case 'summary':
			return alert.summary || 'Unknown';
		case 'startsAt':
			return toLocalDayKey(alert.startsAt);
		case 'updatedAt':
			return toLocalDayKey(alert.updatedAt);
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
