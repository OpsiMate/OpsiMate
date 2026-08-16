import { TableHead } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isTagKeyColumn } from '@/types';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { ReactNode } from 'react';
import { AlertSortField, SortDirection } from '../AlertsTable.types';
import { MAX_MANUAL_WIDTH_PX, MIN_MANUAL_WIDTH_PX } from '../hooks/useColumnResize';
import { BASE_SORT_FIELDS } from './SortableHeader.constants';

const isValidSortField = (value: string): boolean => {
	return BASE_SORT_FIELDS.some((field) => field === value) || isTagKeyColumn(value);
};

export interface SortableHeaderProps {
	column: AlertSortField;
	label: string;
	// Rendered instead of the text label for icon-only narrow columns; the label still
	// shows in the tooltip and stays available to screen readers.
	labelIcon?: ReactNode;
	sortField: AlertSortField;
	sortDirection: SortDirection;
	onSort: (field: AlertSortField) => void;
	className?: string;
	// Inline width for content-aware columns; wins over any width class.
	style?: React.CSSProperties;
	// When set, the header's right edge grows a drag handle: drag resizes the column,
	// double-click returns it to automatic sizing, and with focus on the handle the
	// arrow keys resize step-wise (Backspace/Delete resets). Absent on columns that
	// don't resize (icon columns, actions).
	onResizeStart?: (column: string, event: React.MouseEvent) => void;
	onResizeReset?: (column: string) => void;
	onResizeNudge?: (column: string, direction: -1 | 1, event: React.KeyboardEvent) => void;
	// The column currently mid-drag (any column): keeps THIS handle's active styling on
	// while the pointer inevitably leaves its 8px hit zone during the gesture.
	resizingColumn?: string | null;
}

export const SortableHeader = ({
	column,
	label,
	labelIcon,
	sortField,
	sortDirection,
	onSort,
	className,
	style,
	onResizeStart,
	onResizeReset,
	onResizeNudge,
	resizingColumn,
}: SortableHeaderProps) => {
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

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick();
		}
	};

	return (
		<TableHead
			style={style}
			className={cn('relative h-8 py-1 px-2 text-xs cursor-pointer hover:bg-muted/50 text-foreground', className)}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			tabIndex={0}
			aria-label={label}
			aria-sort={sortField === column ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
		>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-1 min-w-0">
							{labelIcon ? (
								<span className="shrink-0 text-muted-foreground">{labelIcon}</span>
							) : (
								<span className="truncate">{label}</span>
							)}
							<span className="shrink-0">{getSortIcon()}</span>
						</div>
					</TooltipTrigger>
					<TooltipContent>
						<p>{label}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			{onResizeStart && (
				/* Resize handle on the cell's right edge. Wider hit zone (8px) than the
				   visible 2px bar; mousedown starts the drag (the hook stops propagation
				   so releasing doesn't count as a sort click), double-click resets the
				   column to automatic sizing. Keyboard: the handle is its own tab stop —
				   arrows resize step-wise, Backspace/Delete resets. aria-valuenow only
				   when a pixel width is actually applied (auto-sized columns have no
				   number to report). The visible bar shows on hover, while focused, and
				   stays pinned while this column is mid-drag — the pointer leaves the
				   hit zone on any fast drag. */
				<span
					role="separator"
					tabIndex={0}
					aria-orientation="vertical"
					aria-label={`Resize ${label} column`}
					aria-valuemin={MIN_MANUAL_WIDTH_PX}
					aria-valuemax={MAX_MANUAL_WIDTH_PX}
					aria-valuenow={typeof style?.width === 'number' ? style.width : undefined}
					onMouseDown={(e) => onResizeStart(column, e)}
					onDoubleClick={(e) => {
						e.stopPropagation();
						onResizeReset?.(column);
					}}
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => {
						if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
							e.preventDefault();
							e.stopPropagation();
							onResizeNudge?.(column, e.key === 'ArrowLeft' ? -1 : 1, e);
						} else if (e.key === 'Backspace' || e.key === 'Delete') {
							e.preventDefault();
							e.stopPropagation();
							onResizeReset?.(column);
						}
					}}
					className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize select-none group/resize focus-visible:outline-none"
				>
					<span
						className={cn(
							'absolute right-0 top-1 bottom-1 w-0.5 rounded bg-primary/60 opacity-0 transition-opacity',
							'group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100',
							resizingColumn === column && 'opacity-100'
						)}
					/>
				</span>
			)}
		</TableHead>
	);
};
