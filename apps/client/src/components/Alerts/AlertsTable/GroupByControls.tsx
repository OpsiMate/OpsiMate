import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ChevronsDownUp, ChevronsUpDown, GripVertical, Layers, X } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import { ACTIONS_COLUMN, COLUMN_LABELS } from './AlertsTable.constants';
import { GROUP_BY_CONTROLS_TEXT } from './GroupByControls.constants';

interface GroupByControlsProps {
	groupByColumns: string[];
	onGroupByChange: (columns: string[]) => void;
	availableColumns: string[];
	columnLabels?: Record<string, string>;
	onExpandAll?: () => void;
	onCollapseAll?: () => void;
}

const reorderArray = <T,>(arr: T[], fromIndex: number, toIndex: number): T[] => {
	const result = [...arr];
	const [removed] = result.splice(fromIndex, 1);
	result.splice(toIndex, 0, removed);
	return result;
};

interface ExpandCollapseButtonsProps {
	onExpandAll: () => void;
	onCollapseAll: () => void;
}

const ExpandCollapseButtons = ({ onExpandAll, onCollapseAll }: ExpandCollapseButtonsProps) => (
	<div className="flex items-center gap-1">
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={onExpandAll}
					aria-label={GROUP_BY_CONTROLS_TEXT.EXPAND_ALL}
				>
					<ChevronsUpDown className="h-3.5 w-3.5" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>{GROUP_BY_CONTROLS_TEXT.EXPAND_ALL}</TooltipContent>
		</Tooltip>
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={onCollapseAll}
					aria-label={GROUP_BY_CONTROLS_TEXT.COLLAPSE_ALL}
				>
					<ChevronsDownUp className="h-3.5 w-3.5" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>{GROUP_BY_CONTROLS_TEXT.COLLAPSE_ALL}</TooltipContent>
		</Tooltip>
	</div>
);

export const GroupByControls = ({
	groupByColumns,
	onGroupByChange,
	availableColumns,
	columnLabels = COLUMN_LABELS,
	onExpandAll,
	onCollapseAll,
}: GroupByControlsProps) => {
	const groupableColumns = availableColumns.filter((col) => col !== ACTIONS_COLUMN);
	const getLabel = (col: string) => columnLabels[col] || COLUMN_LABELS[col] || col;
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

	const displayColumns = useMemo(() => {
		if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
			return groupByColumns;
		}
		return reorderArray(groupByColumns, draggedIndex, dragOverIndex);
	}, [groupByColumns, draggedIndex, dragOverIndex]);

	const handleAddColumn = (col: string) => {
		onGroupByChange([...groupByColumns, col]);
	};

	const handleRemoveColumn = (col: string) => {
		onGroupByChange(groupByColumns.filter((c) => c !== col));
	};

	const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
		setDraggedIndex(index);
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', index.toString());

		const dragImage = document.createElement('div');
		dragImage.style.position = 'absolute';
		dragImage.style.top = '-1000px';
		dragImage.style.width = '1px';
		dragImage.style.height = '1px';
		dragImage.style.opacity = '0';
		document.body.appendChild(dragImage);
		e.dataTransfer.setDragImage(dragImage, 0, 0);
		setTimeout(() => document.body.removeChild(dragImage), 0);
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
		if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
			setDraggedIndex(null);
			setDragOverIndex(null);
			return;
		}

		onGroupByChange(displayColumns);
		setDraggedIndex(null);
		setDragOverIndex(null);
	};

	const handleDragEnd = () => {
		setDraggedIndex(null);
		setDragOverIndex(null);
	};

	return (
		<TooltipProvider>
			<Popover>
				<Tooltip>
					<PopoverTrigger asChild>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className={cn(
									'h-7 w-7 rounded-md flex-shrink-0 border',
									groupByColumns.length > 0 && 'text-primary border-primary'
								)}
							>
								<div className="relative">
									<Layers className="h-4 w-4" />
									{groupByColumns.length > 0 && (
										<span
											className="absolute h-3.5 w-3.5 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center"
											style={{ top: '-10px', right: '-10px' }}
										>
											{groupByColumns.length}
										</span>
									)}
								</div>
							</Button>
						</TooltipTrigger>
					</PopoverTrigger>
					<TooltipContent>
						{groupByColumns.length > 0 ? (
							<div className="flex flex-col gap-0.5">
								<span className="font-medium">Grouped by:</span>
								<span>{groupByColumns.map((col) => getLabel(col)).join(', ')}</span>
							</div>
						) : (
							<p>Group by</p>
						)}
					</TooltipContent>
				</Tooltip>
				<PopoverContent className="w-[240px] p-0" align="start">
					<Command>
						<div className="flex items-center justify-between px-2 py-1.5">
							<span className="text-sm font-semibold">{GROUP_BY_CONTROLS_TEXT.HEADLINE}</span>
							{groupByColumns.length > 0 && onExpandAll && onCollapseAll && (
								<ExpandCollapseButtons onExpandAll={onExpandAll} onCollapseAll={onCollapseAll} />
							)}
						</div>
						<CommandSeparator />
						<CommandList>
							{groupByColumns.length > 0 && (
								<CommandGroup heading={GROUP_BY_CONTROLS_TEXT.GROUPED_BY_HEADING}>
									{displayColumns.map((col, index) => {
										const originalIndex = groupByColumns.indexOf(col);
										const isDragging = draggedIndex !== null && dragOverIndex !== null;
										const isBeingDragged = originalIndex === draggedIndex;

										return (
											<CommandItem
												key={col}
												className={`flex items-center justify-between text-foreground hover:bg-muted/50 data-[selected=true]:text-white data-[selected=true]:bg-accent [&[data-selected=true]_button_svg]:text-white [&[data-selected=true]_button]:text-white [&[data-selected=true]_div]:text-white [&[data-selected=true]_div]:hover:text-white transition-transform duration-150 ${
													isDragging && isBeingDragged ? 'bg-accent/50 shadow-md' : ''
												}`}
												onSelect={() => {}}
												draggable
												onDragStart={(e) => handleDragStart(e, originalIndex)}
												onDragOver={(e) => handleDragOver(e, index)}
												onDrop={handleDrop}
												onDragEnd={handleDragEnd}
											>
												<div className="flex items-center gap-2 flex-1 min-w-0">
													<div
														className="h-5 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground [&[data-selected=true]]:text-white [&[data-selected=true]]:hover:text-white"
														onMouseDown={(e) => {
															e.stopPropagation();
															const item = e.currentTarget.closest(
																'[draggable]'
															) as HTMLElement;
															if (item) {
																const dragEvent = new DragEvent('dragstart', {
																	bubbles: true,
																	cancelable: true,
																});
																item.dispatchEvent(dragEvent);
															}
														}}
														onClick={(e) => e.stopPropagation()}
														aria-label="Drag to reorder"
													>
														<GripVertical className="h-3.5 w-3.5" />
													</div>
													<span className="truncate">{getLabel(col)}</span>
												</div>
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/30 [&_svg]:hover:text-destructive [&[data-selected=true]]:text-white [&[data-selected=true]]:hover:bg-destructive/40 [&[data-selected=true]]:hover:text-white [&[data-selected=true]_svg]:hover:text-white"
													aria-label="Remove"
													onClick={(e) => {
														e.stopPropagation();
														handleRemoveColumn(col);
													}}
												>
													<X className="h-3 w-3" />
												</Button>
											</CommandItem>
										);
									})}
								</CommandGroup>
							)}
							{groupByColumns.length > 0 && <CommandSeparator />}
							<CommandGroup heading={GROUP_BY_CONTROLS_TEXT.AVAILABLE_COLUMNS_HEADING}>
								{groupableColumns
									.filter((col) => !groupByColumns.includes(col))
									.map((col) => (
										<CommandItem
											key={col}
											onSelect={() => handleAddColumn(col)}
											className="cursor-pointer text-foreground"
										>
											{getLabel(col)}
										</CommandItem>
									))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</TooltipProvider>
	);
};
