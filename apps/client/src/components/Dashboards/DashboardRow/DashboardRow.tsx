import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TableCell, TableRow } from '@/components/ui/table';
import { TagBadge } from '@/components/ui/tag-badge';
import { cn } from '@/lib/utils';
import { Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { COLUMN_WIDTHS } from '../Dashboards.constants';
import { DashboardRowProps } from '../Dashboards.types';
import { formatDate } from '../Dashboards.utils';

export const DashboardRow = ({
	dashboard,
	onClick,
	onDelete,
	onToggleFavorite,
	onAddTag,
	onRemoveTag,
	availableTags = [],
}: DashboardRowProps) => {
	const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

	const dashboardTags = dashboard.tags || [];
	const unassignedTags = availableTags.filter((tag) => !dashboardTags.some((dt) => dt.id === tag.id));

	return (
		<TableRow className="cursor-pointer hover:bg-muted/50 transition-colors group" onClick={onClick}>
			<TableCell className={cn('py-2 px-3 text-center', COLUMN_WIDTHS.favorite)}>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					onClick={(e) => {
						e.stopPropagation();
						onToggleFavorite();
					}}
				>
					<Star
						className={cn(
							'h-4 w-4 transition-colors',
							dashboard.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
						)}
					/>
				</Button>
			</TableCell>
			<TableCell className={cn('py-2 px-3 font-medium truncate', COLUMN_WIDTHS.name)}>{dashboard.name}</TableCell>
			<TableCell className={cn('py-2 px-3 text-muted-foreground truncate', COLUMN_WIDTHS.description)}>
				{dashboard.description || '-'}
			</TableCell>
			<TableCell className={cn('py-2 px-3', COLUMN_WIDTHS.tags)} onClick={(e) => e.stopPropagation()}>
				<div className="flex items-center gap-1 flex-wrap">
					{dashboardTags.map((tag) => (
						<TagBadge
							key={tag.id}
							tag={tag}
							onRemove={onRemoveTag ? () => onRemoveTag(tag.id) : undefined}
							className="text-xs"
						/>
					))}
					{onAddTag && (
						<Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
							<PopoverTrigger asChild>
								<button
									type="button"
									className={cn(
										'inline-flex items-center justify-center h-6 w-6 rounded-full border border-dashed border-muted-foreground/50',
										'hover:bg-muted hover:border-muted-foreground transition-colors',
										'opacity-0 group-hover:opacity-100'
									)}
									aria-label="Add tag"
								>
									<Plus className="h-3 w-3 text-muted-foreground" />
								</button>
							</PopoverTrigger>
							<PopoverContent className="w-[200px] p-0" align="start">
								<Command>
									<CommandInput placeholder="Search tags..." />
									<CommandList>
										<CommandEmpty>No tags available</CommandEmpty>
										<CommandGroup>
											{unassignedTags.map((tag) => (
												<CommandItem
													key={tag.id}
													onSelect={() => {
														onAddTag(tag);
														setTagPopoverOpen(false);
													}}
													className="flex items-center gap-2"
												>
													<div
														className="w-3 h-3 rounded-full"
														style={{ backgroundColor: tag.color }}
													/>
													<span>{tag.name}</span>
												</CommandItem>
											))}
										</CommandGroup>
									</CommandList>
								</Command>
							</PopoverContent>
						</Popover>
					)}
					{!onAddTag && dashboardTags.length === 0 && (
						<span className="text-muted-foreground text-sm">-</span>
					)}
				</div>
			</TableCell>
			<TableCell className={cn('py-2 px-3 text-muted-foreground text-sm', COLUMN_WIDTHS.createdAt)}>
				{formatDate(dashboard.createdAt)}
			</TableCell>
			<TableCell className={cn('py-2 px-3 text-center', COLUMN_WIDTHS.actions)}>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
							onClick={(e) => e.stopPropagation()}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent onClick={(e) => e.stopPropagation()}>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
							<AlertDialogDescription>
								Are you sure you want to delete "{dashboard.name}"? This action cannot be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								onClick={(e) => {
									e.stopPropagation();
									onDelete();
								}}
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</TableCell>
		</TableRow>
	);
};
