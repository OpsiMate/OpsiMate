import { getTagKeyColumnId, isTagKeyColumn, TagKeyInfo } from '@/types';
import { useCallback, useMemo } from 'react';
import { ACTIONS_COLUMN, DEFAULT_COLUMN_ORDER, DEFAULT_VISIBLE_COLUMNS } from '../AlertsTable/AlertsTable.constants';

export interface ColumnManagementOptions {
	tagKeys?: TagKeyInfo[];
	visibleColumns?: string[];
	columnOrder?: string[];
	onVisibleColumnsChange?: (columns: string[]) => void;
}

export const useColumnManagement = (options: ColumnManagementOptions = {}) => {
	const {
		tagKeys = [],
		visibleColumns: controlledVisibleColumns,
		columnOrder: controlledColumnOrder,
		onVisibleColumnsChange,
	} = options;

	const visibleColumns =
		controlledVisibleColumns && controlledVisibleColumns.length > 0
			? controlledVisibleColumns
			: DEFAULT_VISIBLE_COLUMNS;

	const columnOrder =
		controlledColumnOrder && controlledColumnOrder.length > 0 ? controlledColumnOrder : DEFAULT_COLUMN_ORDER;

	const allColumnLabels = useMemo(() => {
		const labels: Record<string, string> = {};
		tagKeys.forEach((tagKey) => {
			labels[getTagKeyColumnId(tagKey.key)] = tagKey.label;
		});
		return labels;
	}, [tagKeys]);

	const tagKeyColumnIds = useMemo(() => tagKeys.map((tk) => getTagKeyColumnId(tk.key)), [tagKeys]);

	const effectiveColumnOrder = useMemo(() => {
		const tagKeysInOrder = visibleColumns.filter((col) => isTagKeyColumn(col));
		const baseOrder = columnOrder.filter((col) => !isTagKeyColumn(col) && col !== ACTIONS_COLUMN);
		return [...baseOrder, ...tagKeysInOrder];
	}, [columnOrder, visibleColumns]);

	const handleColumnToggle = useCallback(
		(column: string) => {
			if (!onVisibleColumnsChange) return;

			const newColumns = visibleColumns.includes(column)
				? visibleColumns.filter((col) => col !== column)
				: [...visibleColumns, column];

			onVisibleColumnsChange(newColumns);
		},
		[visibleColumns, onVisibleColumnsChange]
	);

	const enabledTagKeys = useMemo(
		() => tagKeys.filter((tk) => visibleColumns.includes(getTagKeyColumnId(tk.key))),
		[tagKeys, visibleColumns]
	);

	return {
		visibleColumns,
		columnOrder: effectiveColumnOrder,
		handleColumnToggle,
		allColumnLabels,
		tagKeyColumnIds,
		enabledTagKeys,
	};
};
