import { useMemo, useState } from 'react';
import { Alert } from '@OpsiMate/shared';
import { flattenGroups, groupAlerts } from '../AlertsTable.utils';
import { FlatGroupItem } from '../AlertsTable.types';

export const useAlertGrouping = (sortedAlerts: Alert[]) => {
	const [groupByColumns, setGroupByColumns] = useState<string[]>([]);
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

	const groupedData = useMemo(() => {
		if (groupByColumns.length === 0) return [];
		return groupAlerts(sortedAlerts, groupByColumns);
	}, [sortedAlerts, groupByColumns]);

	const flatRows = useMemo(() => {
		if (groupByColumns.length === 0) {
			return sortedAlerts.map((alert) => ({ type: 'leaf' as const, alert }));
		}
		return flattenGroups(groupedData, expandedGroups);
	}, [sortedAlerts, groupedData, expandedGroups, groupByColumns]);

	const toggleGroup = (key: string) => {
		const newExpanded = new Set(expandedGroups);
		if (newExpanded.has(key)) {
			newExpanded.delete(key);
		} else {
			newExpanded.add(key);
		}
		setExpandedGroups(newExpanded);
	};

	return {
		groupByColumns,
		setGroupByColumns,
		expandedGroups,
		flatRows,
		toggleGroup,
	};
};
