import { TableHead } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isTagKeyColumn } from '@/types';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { AlertSortField, SortDirection } from '../AlertsTable.types';
import { BASE_SORT_FIELDS } from './SortableHeader.constants';

const isValidSortField = (value: string): boolean => {
	return (BASE_SORT_FIELDS as readonly string[]).includes(value) || isTagKeyColumn(value);
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
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-1 min-w-0">
							<span className="truncate">{label}</span>
							<span className="flex-shrink-0">{getSortIcon()}</span>
						</div>
					</TooltipTrigger>
					<TooltipContent>
						<p>{label}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</TableHead>
	);
};
