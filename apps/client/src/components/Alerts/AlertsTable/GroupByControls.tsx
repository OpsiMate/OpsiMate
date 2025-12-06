import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowDown, ArrowUp, Layers, X } from 'lucide-react';
import { COLUMN_LABELS } from './AlertsTable.constants';
import { GROUP_BY_CONTROLS_TEXT } from './GroupByControls.constants';

interface GroupByControlsProps {
	groupByColumns: string[];
	onGroupByChange: (columns: string[]) => void;
	availableColumns: string[];
	columnLabels?: Record<string, string>;
}

export const GroupByControls = ({
	groupByColumns,
	onGroupByChange,
	availableColumns,
	columnLabels = COLUMN_LABELS,
}: GroupByControlsProps) => {
	const groupableColumns = availableColumns.filter((col) => col !== 'actions');
	const getLabel = (col: string) => columnLabels[col] || COLUMN_LABELS[col] || col;

	const handleAddColumn = (col: string) => {
		onGroupByChange([...groupByColumns, col]);
	};

	const handleRemoveColumn = (col: string) => {
		onGroupByChange(groupByColumns.filter((c) => c !== col));
	};

	const handleMoveUp = (index: number) => {
		if (index === 0) return;
		const newCols = [...groupByColumns];
		[newCols[index - 1], newCols[index]] = [newCols[index], newCols[index - 1]];
		onGroupByChange(newCols);
	};

	const handleMoveDown = (index: number) => {
		if (index === groupByColumns.length - 1) return;
		const newCols = [...groupByColumns];
		[newCols[index + 1], newCols[index]] = [newCols[index], newCols[index + 1]];
		onGroupByChange(newCols);
	};

	return (
		<div className="flex items-center gap-1">
			<Popover>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm" className="h-8 border-dashed">
						<Layers className="mr-2 h-4 w-4 text-foreground" />
						<span className="text-foreground">{GROUP_BY_CONTROLS_TEXT.TRIGGER_LABEL}</span>
						{groupByColumns.length > 0 && (
							<>
								<span className="mx-2 h-4 w-[1px] bg-border" />
								<span className="text-xs text-foreground">
									{groupByColumns.map((col) => getLabel(col)).join(', ')}
								</span>
							</>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[240px] p-0" align="start">
					<Command>
						<CommandList>
							{groupByColumns.length > 0 && (
								<CommandGroup heading={GROUP_BY_CONTROLS_TEXT.GROUPED_BY_HEADING}>
									{groupByColumns.map((col, index) => (
										<CommandItem
											key={col}
											className="flex items-center justify-between text-foreground data-[selected=true]:text-white"
											onSelect={() => {}}
										>
											<span className="truncate mr-2">{getLabel(col)}</span>
											<div className="flex items-center gap-1">
												<Button
													variant="ghost"
													size="icon"
													className="h-5 w-5 hover:bg-transparent"
													disabled={index === 0}
													aria-label="Move up"
													onClick={(e) => {
														e.stopPropagation();
														handleMoveUp(index);
													}}
												>
													<ArrowUp className="h-3 w-3" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="h-5 w-5 hover:bg-transparent"
													disabled={index === groupByColumns.length - 1}
													aria-label="Move down"
													onClick={(e) => {
														e.stopPropagation();
														handleMoveDown(index);
													}}
												>
													<ArrowDown className="h-3 w-3" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="h-5 w-5 text-destructive hover:text-white hover:bg-transparent"
													aria-label="Remove"
													onClick={(e) => {
														e.stopPropagation();
														handleRemoveColumn(col);
													}}
												>
													<X className="h-3 w-3" />
												</Button>
											</div>
										</CommandItem>
									))}
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
			{groupByColumns.length > 0 && (
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-foreground"
					onClick={() => onGroupByChange([])}
					title={GROUP_BY_CONTROLS_TEXT.RESET_TOOLTIP}
					aria-label={GROUP_BY_CONTROLS_TEXT.RESET_TOOLTIP}
				>
					<X className="h-4 w-4" />
				</Button>
			)}
		</div>
	);
};
