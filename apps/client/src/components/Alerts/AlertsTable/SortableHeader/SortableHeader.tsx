import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { AlertSortField, SortDirection } from '../AlertsTable.types';

const VALID_SORT_FIELDS: AlertSortField[] = ['alertName', 'status', 'tag', 'startsAt', 'summary', 'type', 'owner'];

const isValidSortField = (value: string): value is AlertSortField => {
	return VALID_SORT_FIELDS.includes(value as AlertSortField);
};

export interface SortableHeaderProps {
	column: AlertSortField;
	label: string;
	sortField: AlertSortField;
	sortDirection: SortDirection;
	onSort: (field: AlertSortField) => void;
	className?: string;
}

export const SortableHeader = ({ column, label, sortField, sortDirection, onSort, className }: SortableHeaderProps) => {
	const getSortIcon = () => {
		if (sortField !== column) {
			return <ArrowUpDown className="h-3 w-3 text-foreground" />;
		}
		return sortDirection === 'asc' ? (
			<ArrowUp className="h-3 w-3 text-foreground" />
		) : (
			<ArrowDown className="h-3 w-3 text-foreground" />
		);
	};

	const handleClick = () => {
		if (isValidSortField(column)) {
			onSort(column);
		}
	};

	return (
		<TableHead
			className={cn('h-8 py-1 px-2 text-xs cursor-pointer hover:bg-muted/50 text-foreground', className)}
			onClick={handleClick}
		>
			<div className="flex items-center gap-1">
				{label}
				{getSortIcon()}
			</div>
		</TableHead>
	);
};
