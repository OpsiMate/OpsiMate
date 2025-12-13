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
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { TableCell, TableRow } from '@/components/ui/table';
import { TagBadge } from '@/components/ui/tag-badge';
import { queryKeys } from '@/hooks/queries/queryKeys';
import { useToast } from '@/hooks/use-toast';
import { providerApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Tag } from '@OpsiMate/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { COLUMN_WIDTHS } from '../Dashboards.constants';
import { DashboardRowProps } from '../Dashboards.types';
import { formatDate } from '../Dashboards.utils';

const PREDEFINED_COLORS = [
	'#3B82F6',
	'#EF4444',
	'#10B981',
	'#F59E0B',
	'#8B5CF6',
	'#F97316',
	'#06B6D4',
	'#EC4899',
	'#84CC16',
	'#6B7280',
];

export const DashboardRow = ({
	dashboard,
	onClick,
	onDelete,
	onToggleFavorite,
	onAddTag,
	onRemoveTag,
	availableTags = [],
}: DashboardRowProps) => {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
	const [isCreatingTag, setIsCreatingTag] = useState(false);
	const [newTagName, setNewTagName] = useState('');
	const [newTagColor, setNewTagColor] = useState(PREDEFINED_COLORS[0]);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const dashboardTags = dashboard.tags || [];
	const unassignedTags = availableTags.filter((tag) => !dashboardTags.some((dt) => dt.id === tag.id));

	const handleCreateTag = async () => {
		if (!newTagName.trim()) {
			toast({
				title: 'Error',
				description: 'Tag name is required',
				variant: 'destructive',
			});
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await providerApi.createTag({ name: newTagName.trim(), color: newTagColor });

			if (response.success && response.data) {
				onAddTag?.(response.data);
				queryClient.invalidateQueries({ queryKey: queryKeys.tags });
				resetCreateForm();
				setTagPopoverOpen(false);
			} else {
				toast({
					title: 'Error',
					description: response.error || 'Failed to create tag',
					variant: 'destructive',
				});
			}
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Failed to create tag',
				variant: 'destructive',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const resetCreateForm = () => {
		setNewTagName('');
		setNewTagColor(PREDEFINED_COLORS[0]);
		setIsCreatingTag(false);
	};

	const handlePopoverOpenChange = (open: boolean) => {
		setTagPopoverOpen(open);
		if (!open) {
			resetCreateForm();
		}
	};

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
						<Popover open={tagPopoverOpen} onOpenChange={handlePopoverOpenChange}>
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
							<PopoverContent className="w-[240px] p-0" align="start">
								{isCreatingTag ? (
									<div className="p-3 space-y-3">
										<div className="text-sm font-medium">Create new tag</div>
										<Input
											placeholder="Tag name"
											value={newTagName}
											onChange={(e) => setNewTagName(e.target.value)}
											className="h-8"
											autoFocus
											onKeyDown={(e) => {
												if (e.key === 'Enter' && newTagName.trim()) {
													handleCreateTag();
												}
												if (e.key === 'Escape') {
													resetCreateForm();
												}
											}}
										/>
										<div className="flex flex-wrap gap-1.5">
											{PREDEFINED_COLORS.map((color) => (
												<button
													key={color}
													type="button"
													className={cn(
														'w-6 h-6 rounded-full transition-all border-2',
														newTagColor === color
															? 'border-foreground scale-110'
															: 'border-transparent hover:scale-105'
													)}
													style={{ backgroundColor: color }}
													onClick={() => setNewTagColor(color)}
												/>
											))}
										</div>
										<div className="flex gap-2">
											<Button
												variant="ghost"
												size="sm"
												className="flex-1 h-8"
												onClick={resetCreateForm}
												disabled={isSubmitting}
											>
												Cancel
											</Button>
											<Button
												size="sm"
												className="flex-1 h-8"
												onClick={handleCreateTag}
												disabled={isSubmitting || !newTagName.trim()}
											>
												{isSubmitting ? (
													<>
														<Loader2 className="h-3 w-3 animate-spin mr-1" />
														Creating...
													</>
												) : (
													'Create'
												)}
											</Button>
										</div>
									</div>
								) : (
									<div className="py-1">
										{unassignedTags.length > 0 && (
											<>
												<div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
													Available tags
												</div>
												<div className="max-h-[150px] overflow-y-auto">
													{unassignedTags.map((tag) => (
														<button
															key={tag.id}
															className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted transition-colors text-left"
															onClick={() => {
																onAddTag(tag);
																setTagPopoverOpen(false);
															}}
														>
															<div
																className="w-3 h-3 rounded-full flex-shrink-0"
																style={{ backgroundColor: tag.color }}
															/>
															<span className="text-sm truncate">{tag.name}</span>
														</button>
													))}
												</div>
												<Separator className="my-1" />
											</>
										)}
										<button
											className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted transition-colors text-left text-muted-foreground"
											onClick={() => setIsCreatingTag(true)}
										>
											<Plus className="h-4 w-4" />
											<span className="text-sm">Create new tag</span>
										</button>
									</div>
								)}
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
