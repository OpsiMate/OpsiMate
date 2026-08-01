import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getTagKeyColumnId, TagKeyInfo } from '@/types';
import { Columns3, GripVertical, Search, X } from 'lucide-react';
import { DragEvent, useState } from 'react';
import { TOGGLE_COLUMNS_LABEL } from './ColumnSettingsDropdown.constants';

export interface ColumnSettingsDropdownProps {
	visibleColumns: string[];
	onColumnToggle: (column: string) => void;
	columnLabels: Record<string, string>;
	// Current base-column order; the list renders in this order and drags rearrange it.
	columnOrder?: string[];
	// When provided, the base columns get drag handles; called with the full new base order.
	onColumnOrderChange?: (columns: string[]) => void;
	excludeColumns?: string[];
	tagKeys?: TagKeyInfo[];
}

export const ColumnSettingsDropdown = ({
	visibleColumns,
	onColumnToggle,
	columnLabels,
	columnOrder = [],
	onColumnOrderChange,
	excludeColumns = [],
	tagKeys = [],
}: ColumnSettingsDropdownProps) => {
	const [searchQuery, setSearchQuery] = useState('');
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

	// One flat list: base columns and tag-key columns together, sorted by the current
	// column order — the user arranges the table freely, nothing is segregated. Columns
	// the (possibly stale) saved order doesn't know about sink to the end: base columns
	// first, then tag keys, each group keeping its own listing order.
	const availableColumns: [string, string][] = [
		...Object.entries(columnLabels).filter(([key]) => !excludeColumns.includes(key)),
		...tagKeys.map((tagKey): [string, string] => [getTagKeyColumnId(tagKey.key), tagKey.label]),
	].sort(([a], [b]) => {
		const ia = columnOrder.indexOf(a);
		const ib = columnOrder.indexOf(b);
		if (ia === -1 && ib === -1) return 0;
		return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
	});

	// Filter columns based on search query
	const filteredColumns = availableColumns.filter(([, label]) =>
		label.toLowerCase().includes(searchQuery.toLowerCase())
	);

	// Reordering is disabled while searching — dragging within a filtered subset would
	// splice items at misleading positions.
	const canReorder = !!onColumnOrderChange && !searchQuery;

	// Live preview: the list as it would look if the dragged item were dropped here.
	const displayColumns = (() => {
		if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
			return filteredColumns;
		}
		const next = [...filteredColumns];
		const [moved] = next.splice(draggedIndex, 1);
		next.splice(dragOverIndex, 0, moved);
		return next;
	})();

	const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
		setDraggedIndex(index);
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', index.toString());
	};

	const handleDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		if (draggedIndex === null) return;
		setDragOverIndex(index);
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
			onColumnOrderChange?.(displayColumns.map(([key]) => key));
		}
		setDraggedIndex(null);
		setDragOverIndex(null);
	};

	const handleDragEnd = () => {
		setDraggedIndex(null);
		setDragOverIndex(null);
	};

	const totalItems = filteredColumns.length;

	return (
		<div className="flex items-center border rounded-md">
			<DropdownMenu>
				<Tooltip>
					<TooltipTrigger asChild>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 rounded-md hover:bg-muted hover:text-foreground"
							>
								<Columns3 className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
					</TooltipTrigger>
					<TooltipContent>{TOGGLE_COLUMNS_LABEL}</TooltipContent>
				</Tooltip>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuLabel>{TOGGLE_COLUMNS_LABEL}</DropdownMenuLabel>
					<DropdownMenuSeparator />

					{/* Search Input */}
					<div className="px-2 pb-2">
						<div className="relative">
							<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
							<Input
								placeholder="Search columns..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-7 pr-7 h-7 text-xs"
								onKeyDown={(e) => e.stopPropagation()}
							/>
							{searchQuery && (
								<button
									onClick={() => setSearchQuery('')}
									className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								>
									<X className="h-3.5 w-3.5" />
								</button>
							)}
						</div>
					</div>

					{/* Scrollable Column List */}
					<div className={totalItems > 10 ? 'max-h-[280px] overflow-y-auto' : ''}>
						{displayColumns.map(([key, label], index) => (
							<div
								key={key}
								draggable={canReorder}
								onDragStart={(e) => handleDragStart(e, index)}
								onDragOver={(e) => handleDragOver(e, index)}
								onDrop={handleDrop}
								onDragEnd={handleDragEnd}
								className={
									draggedIndex !== null && displayColumns[dragOverIndex ?? -1]?.[0] === key
										? 'rounded-sm bg-accent/50'
										: undefined
								}
							>
								<DropdownMenuCheckboxItem
									checked={visibleColumns.includes(key)}
									onCheckedChange={() => onColumnToggle(key)}
									onSelect={(e) => e.preventDefault()}
									className={canReorder ? 'pr-7 relative' : undefined}
								>
									{label}
									{canReorder && (
										<span
											className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
											aria-label={`Drag to reorder ${label}`}
										>
											<GripVertical className="h-3.5 w-3.5" />
										</span>
									)}
								</DropdownMenuCheckboxItem>
							</div>
						))}

						{/* No Results */}
						{totalItems === 0 && searchQuery && (
							<p className="text-xs text-muted-foreground text-center py-3 px-2">
								No columns match "{searchQuery}"
							</p>
						)}
					</div>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};
