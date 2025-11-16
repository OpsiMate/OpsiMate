import { TableHead } from '@/components/ui/table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { AlertSortField, SortDirection } from '../AlertsTable.types';

export interface SortableHeaderProps {
	column: string;
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

	return (
		<TableHead
			className="h-8 py-1 px-2 text-xs cursor-pointer hover:bg-muted/50"
			onClick={() => onSort(column as AlertSortField)}
		>
			<div className="flex items-center gap-1">
				{label}
				{getSortIcon()}
			</div>
		</TableHead>
	);
};
