import { getTagKeyColumnId, isTagKeyColumn, TagKeyInfo } from '@/types';
import { useCallback, useMemo, useState } from 'react';
import { DEFAULT_COLUMN_ORDER, DEFAULT_VISIBLE_COLUMNS } from '../AlertsTable/AlertsTable.constants';

export interface ColumnManagementOptions {
	tagKeys?: TagKeyInfo[];
}

export const useColumnManagement = (options: ColumnManagementOptions = {}) => {
	const { tagKeys = [] } = options;
	const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
	const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);

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
		const baseOrder = columnOrder.filter((col) => !isTagKeyColumn(col));
		const actionsIdx = baseOrder.indexOf('actions');
		if (actionsIdx >= 0 && tagKeysInOrder.length > 0) {
			return [...baseOrder.slice(0, actionsIdx), ...tagKeysInOrder, ...baseOrder.slice(actionsIdx)];
		}
		return [...baseOrder, ...tagKeysInOrder];
	}, [columnOrder, visibleColumns]);

	const handleColumnToggle = useCallback((column: string) => {
		setVisibleColumns((prev) => {
			if (prev.includes(column)) {
				return prev.filter((col) => col !== column);
			} else {
				return [...prev, column];
			}
		});
	}, []);

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
