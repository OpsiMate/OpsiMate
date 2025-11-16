import { useState } from 'react';

export const useColumnManagement = () => {
	const [visibleColumns, setVisibleColumns] = useState([
		'type',
		'alertName',
		'status',
		'tag',
		'summary',
		'startsAt',
		'actions',
	]);
	const [columnOrder, setColumnOrder] = useState([
		'type',
		'alertName',
		'status',
		'tag',
		'summary',
		'startsAt',
		'actions',
	]);

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
