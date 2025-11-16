import { useState } from 'react';
import { DEFAULT_COLUMN_ORDER, DEFAULT_VISIBLE_COLUMNS } from '../AlertsTable/AlertsTable.constants';

export const useColumnManagement = () => {
	const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
	const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);

	const handleColumnToggle = (column: string) => {
		setVisibleColumns((prev) => {
			if (prev.includes(column)) {
				return prev.filter((col) => col !== column);
			} else {
				return [...prev, column];
			}
		});
	};

	return {
		visibleColumns,
		columnOrder,
		handleColumnToggle,
	};
};
