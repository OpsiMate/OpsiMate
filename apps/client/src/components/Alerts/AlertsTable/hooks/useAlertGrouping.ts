import { Alert } from '@OpsiMate/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createTagKeyValueGetter, flattenGroups, groupAlerts } from '../AlertsTable.utils';
import { ALERTS_GROUP_BY_STORAGE_KEY } from './useAlertGrouping.constants';

export const useAlertGrouping = (
	sortedAlerts: Alert[],
	columnLabels: Record<string, string> = {},
	controlledGroupBy?: string[],
	onGroupByChange?: (cols: string[]) => void
) => {
	const [localGroupByColumns, setLocalGroupByColumns] = useState<string[]>(() => {
		try {
			const saved = localStorage.getItem(ALERTS_GROUP_BY_STORAGE_KEY);
			return saved ? JSON.parse(saved) : [];
		} catch {
			return [];
		}
	});

	const groupByColumns = controlledGroupBy !== undefined ? controlledGroupBy : localGroupByColumns;

	const setGroupByColumns = useCallback(
		(cols: string[] | ((prev: string[]) => string[])) => {
			if (onGroupByChange) {
				const newCols = typeof cols === 'function' ? cols(groupByColumns) : cols;
				onGroupByChange(newCols);
			} else {
				setLocalGroupByColumns(cols);
			}
		},
		[groupByColumns, onGroupByChange]
	);

	useEffect(() => {
		if (controlledGroupBy === undefined) {
			localStorage.setItem(ALERTS_GROUP_BY_STORAGE_KEY, JSON.stringify(groupByColumns));
		}
	}, [groupByColumns, controlledGroupBy]);

	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

	const valueGetter = useMemo(() => createTagKeyValueGetter(columnLabels), [columnLabels]);

	const groupedData = useMemo(() => {
		if (groupByColumns.length === 0) return [];
		return groupAlerts(sortedAlerts, groupByColumns, valueGetter);
	}, [sortedAlerts, groupByColumns, valueGetter]);

	const flatRows = useMemo(() => {
		if (groupByColumns.length === 0) {
			return sortedAlerts.map((alert) => ({ type: 'leaf' as const, alert }));
		}
		return flattenGroups(groupedData, expandedGroups);
	}, [sortedAlerts, groupedData, expandedGroups, groupByColumns]);

	const toggleGroup = useCallback((key: string) => {
		setExpandedGroups((prev) => {
			const newExpanded = new Set(prev);
			if (newExpanded.has(key)) {
				newExpanded.delete(key);
			} else {
				newExpanded.add(key);
			}
			return newExpanded;
		});
	}, []);

	return {
		groupByColumns,
		setGroupByColumns,
		expandedGroups,
		flatRows,
		toggleGroup,
	};
};
