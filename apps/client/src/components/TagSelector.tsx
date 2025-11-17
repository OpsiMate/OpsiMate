import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { providerApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Tag } from '@OpsiMate/shared';
import { Plus, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { CreateTagDialog } from './CreateTagDialog';
import { DeleteTagDialog } from './DeleteTagDialog';
import { TagBadge } from './ui/tag-badge';

interface TagSelectorProps {
	selectedTags: Tag[];
	onTagsChange: (tags: Tag[]) => void;
	serviceId: number;
	className?: string;
}

export const TagSelector = ({ selectedTags, onTagsChange, serviceId, className }: TagSelectorProps) => {
	const { toast } = useToast();
	const [open, setOpen] = useState(false);
	const [allTags, setAllTags] = useState<Tag[]>([]);
	const [loading, setLoading] = useState(false);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

	const fetchTags = useCallback(async () => {
		setLoading(true);
		try {
			const response = await providerApi.getAllTags();
			if (response.success && response.data) {
				setAllTags(response.data);
			}
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Failed to fetch tags',
				variant: 'destructive',
			});
		} finally {
			setLoading(false);
		}
	}, [toast]);

	useEffect(() => {
		fetchTags();
	}, [fetchTags]);

	const addTag = async (tag: Tag) => {
		try {
			const response = await providerApi.addTagToService(Number(serviceId), Number(tag.id));
			if (response.success) {
				onTagsChange([...selectedTags, tag]);
			} else {
				toast({
					title: 'Error',
					description: response.error || 'Failed to add tag',
					variant: 'destructive',
				});
			}
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Failed to add tag',
				variant: 'destructive',
			});
		}
	};

	const removeTag = async (tag: Tag) => {
		try {
			const response = await providerApi.removeTagFromService(Number(serviceId), Number(tag.id));
			if (response.success) {
				onTagsChange(selectedTags.filter((t) => t.id !== tag.id));
				toast({
					title: 'Success',
					description: 'Tag removed from service',
				});
			} else {
				toast({
					title: 'Error',
					description: response.error || 'Failed to remove tag',
					variant: 'destructive',
				});
			}
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Failed to remove tag',
				variant: 'destructive',
			});
		}
	};

	const handleTagCreated = (newTag: Tag) => {
		setAllTags([...allTags, newTag]);
		// Optionally auto-add the new tag to the service
		addTag(newTag);
	};

	const handleTagDeleted = (tagId: number) => {
		// Remove the tag from all tags list
		setAllTags(allTags.filter((tag) => tag.id !== tagId));

		// Remove the tag from selected tags if it was selected
		if (selectedTags.some((tag) => tag.id === tagId)) {
			onTagsChange(selectedTags.filter((tag) => tag.id !== tagId));
		}
	};

	const handleDeleteClick = (e: React.MouseEvent, tag: Tag) => {
		e.preventDefault();
		e.stopPropagation();
		setTagToDelete(tag);
		setShowDeleteDialog(true);
	};

	const availableTags = allTags.filter((tag) => !selectedTags.some((selected) => selected.id === tag.id));

	return (
		<>
			<div className={cn('flex flex-wrap gap-1 items-center', className)}>
				{selectedTags.map((tag) => (
					<TagBadge key={tag.id} tag={tag} onRemove={() => removeTag(tag)} className="text-xs" />
				))}
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<button
							type="button"
							className={cn(
								'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border border-gray-200 bg-muted transition-colors',
								'h-7 min-w-[32px] justify-center',
								'hover:bg-muted/80 focus:bg-muted/80 active:bg-muted/90',
								'focus:outline-none'
								// Remove strong focus ring
								// open && "ring-2 ring-ring"
							)}
							aria-label="Add tag"
						>
							<Plus className="h-4 w-4" />
						</button>
					</PopoverTrigger>
					<PopoverContent className="w-[300px] p-0">
						<Command>
							<CommandInput placeholder="Search tags..." />
							<CommandList>
								<CommandEmpty>
									<div className="flex flex-col items-center gap-2 p-4">
										<p className="text-sm text-muted-foreground">No tags found</p>
										<Button
											variant="outline"
											size="sm"
											onClick={() => {
												setOpen(false);
												setShowCreateDialog(true);
											}}
											className="gap-2"
										>
											<Plus className="h-4 w-4" />
											Create new tag
										</Button>
									</div>
								</CommandEmpty>
								<CommandGroup>
									{availableTags.map((tag) => (
										<CommandItem
											key={tag.id}
											onSelect={() => addTag(tag)}
											className="flex items-center justify-between gap-2 group"
										>
											<div className="flex items-center gap-2 flex-1">
												<div
													className="w-3 h-3 rounded-full"
													style={{ backgroundColor: tag.color }}
												/>
												<span>{tag.name}</span>
											</div>
											<button
												onClick={(e) => handleDeleteClick(e, tag)}
												className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-white hover:text-white/80"
												title="Delete tag"
											>
												<X className="h-3 w-3 font-bold" />
											</button>
										</CommandItem>
									))}
									{availableTags.length > 0 && (
										<CommandItem
											onSelect={() => {
												setOpen(false);
												setShowCreateDialog(true);
											}}
											className="flex items-center gap-2 text-muted-foreground"
										>
											<Plus className="h-4 w-4" />
											Create new tag
										</CommandItem>
									)}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</div>

			<CreateTagDialog
				open={showCreateDialog}
				onClose={() => setShowCreateDialog(false)}
				onTagCreated={handleTagCreated}
			/>

			<DeleteTagDialog
				open={showDeleteDialog}
				onClose={() => {
					setShowDeleteDialog(false);
					setTagToDelete(null);
				}}
				tag={tagToDelete}
				onTagDeleted={handleTagDeleted}
			/>
		</>
	);
};
