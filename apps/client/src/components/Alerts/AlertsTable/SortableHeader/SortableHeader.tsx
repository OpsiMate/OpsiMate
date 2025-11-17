import { TableHead } from '@/components/ui/table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { AlertSortField, SortDirection } from '../AlertsTable.types';

const VALID_SORT_FIELDS: AlertSortField[] = ['alertName', 'status', 'tag', 'startsAt', 'summary', 'type'];

const isValidSortField = (value: string): value is AlertSortField => {
	return VALID_SORT_FIELDS.includes(value as AlertSortField);
};

export interface SortableHeaderProps {
	column: AlertSortField;
	label: string;
	sortField: AlertSortField;
	sortDirection: SortDirection;
	onSort: (field: AlertSortField) => void;
}

export const SortableHeader = ({ column, label, sortField, sortDirection, onSort }: SortableHeaderProps) => {
	const getSortIcon = () => {
		if (sortField !== column) {
			return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
		}
		return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
	};

	const handleClick = () => {
		if (isValidSortField(column)) {
			onSort(column);
		}
	};

	return (
		<TableHead className="h-8 py-1 px-2 text-xs cursor-pointer hover:bg-muted/50" onClick={handleClick}>
			<div className="flex items-center gap-1">
				{label}
				{getSortIcon()}
			</div>
		</TableHead>
	);
};
