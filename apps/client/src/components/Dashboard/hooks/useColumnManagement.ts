import { ServiceCustomField } from '@OpsiMate/shared';
import { useCallback, useEffect, useState } from 'react';
import { ColumnVisibility } from '../Dashboard.types';

interface ColumnManagementResult {
	visibleColumns: ColumnVisibility;
	columnOrder: string[];
	setVisibleColumns: React.Dispatch<React.SetStateAction<ColumnVisibility>>;
	setColumnOrder: React.Dispatch<React.SetStateAction<string[]>>;
	handleColumnToggle: (column: string) => void;
}

const DEFAULT_VISIBLE_COLUMNS: ColumnVisibility = {
	name: true,
	serviceIP: true,
	serviceStatus: true,
	provider: true,
	containerDetails: false,
	tags: true,
	alerts: true,
};

const DEFAULT_COLUMN_ORDER = ['name', 'serviceIP', 'serviceStatus', 'provider', 'containerDetails', 'tags', 'alerts'];

export const useColumnManagement = (customFields: ServiceCustomField[]): ColumnManagementResult => {
	const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(DEFAULT_VISIBLE_COLUMNS);
	const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);

	useEffect(() => {
		if (customFields.length > 0) {
			setVisibleColumns((prev) => {
				const updated = { ...prev };
				customFields.forEach((field) => {
					const key = `custom-${field.id}`;
					if (!(key in updated)) {
						updated[key] = false;
					}
				});
				return updated;
			});

			setColumnOrder((prev) => {
				const customFieldKeys = customFields.map((field) => `custom-${field.id}`);
				const newFields = customFieldKeys.filter((key) => !prev.includes(key));
				return [...prev, ...newFields];
			});
		}
	}, [customFields]);

	const handleColumnToggle = useCallback((column: string) => {
		setVisibleColumns((prev) => ({
			...prev,
			[column]: !prev[column],
		}));
	}, []);

	return {
		visibleColumns,
		columnOrder,
		setVisibleColumns,
		setColumnOrder,
		handleColumnToggle,
	};
};
