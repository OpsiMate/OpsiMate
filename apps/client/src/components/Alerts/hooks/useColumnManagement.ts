import { getTagKeyColumnId, isTagKeyColumn, TagKeyInfo } from '@/types';
import { useCallback, useMemo } from 'react';
import { ACTIONS_COLUMN, DEFAULT_COLUMN_ORDER, DEFAULT_VISIBLE_COLUMNS } from '../AlertsTable/AlertsTable.constants';

export interface ColumnManagementOptions {
	tagKeys?: TagKeyInfo[];
	visibleColumns?: string[];
	columnOrder?: string[];
	onVisibleColumnsChange?: (columns: string[]) => void;
}

// The severity column shipped after users may have persisted column lists, and those
// lists replace the defaults wholesale — so severity would stay invisible for every
// pre-existing dashboard. Inject it (after `type`, like the default) unless the user
// has explicitly hidden it, which we remember per browser.
const SEVERITY_HIDDEN_KEY = 'opsimate-severity-column-hidden';

const withSeverity = (columns: string[]): string[] => {
	if (columns.includes('severity')) return columns;
	if (localStorage.getItem(SEVERITY_HIDDEN_KEY) === 'true') return columns;
	const typeIndex = columns.indexOf('type');
	const next = [...columns];
	next.splice(typeIndex >= 0 ? typeIndex + 1 : 0, 0, 'severity');
	return next;
};

export const useColumnManagement = (options: ColumnManagementOptions = {}) => {
	const {
		tagKeys = [],
		visibleColumns: controlledVisibleColumns,
		columnOrder: controlledColumnOrder,
		onVisibleColumnsChange,
	} = options;

	const visibleColumns = useMemo(
		() =>
			withSeverity(
				controlledVisibleColumns && controlledVisibleColumns.length > 0
					? controlledVisibleColumns
					: DEFAULT_VISIBLE_COLUMNS
			),
		[controlledVisibleColumns]
	);

	const columnOrder = useMemo(
		() =>
			withSeverity(
				controlledColumnOrder && controlledColumnOrder.length > 0 ? controlledColumnOrder : DEFAULT_COLUMN_ORDER
			),
		[controlledColumnOrder]
	);

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

			const isVisible = visibleColumns.includes(column);
			// Remember an explicit severity hide so the auto-injection above stops.
			if (column === 'severity') {
				if (isVisible) {
					localStorage.setItem(SEVERITY_HIDDEN_KEY, 'true');
				} else {
					localStorage.removeItem(SEVERITY_HIDDEN_KEY);
				}
			}

			const newColumns = isVisible ? visibleColumns.filter((col) => col !== column) : [...visibleColumns, column];

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
