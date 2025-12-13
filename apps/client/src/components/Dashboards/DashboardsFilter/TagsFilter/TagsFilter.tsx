import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TagBadge } from '@/components/ui/tag-badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Tag } from '@OpsiMate/shared';
import { Check, Tags } from 'lucide-react';

interface TagsFilterProps {
	availableTags: Tag[];
	selectedTagIds: number[];
	onTagToggle: (tagId: number) => void;
	onClearAll: () => void;
}

export const TagsFilter = ({ availableTags, selectedTagIds, onTagToggle, onClearAll }: TagsFilterProps) => {
	const selectedTags = availableTags.filter((tag) => selectedTagIds.includes(tag.id));

	return (
		<div className="flex items-center gap-2 border rounded-md p-1 bg-background">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className={cn('gap-2 h-7', selectedTagIds.length > 0 && 'text-primary')}
					>
						<Tags className="h-4 w-4" />
						Tags
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[200px] p-2" align="start">
					{availableTags.length === 0 ? (
						<div className="text-sm text-muted-foreground text-center py-2">No tags available</div>
					) : (
						<>
							<div className="space-y-1">
								{availableTags.map((tag) => (
									<button
										key={tag.id}
										className={cn(
											'w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left',
											selectedTagIds.includes(tag.id) ? 'bg-primary/10' : 'hover:bg-muted'
										)}
										onClick={() => onTagToggle(tag.id)}
									>
										<div
											className="w-3 h-3 rounded-full flex-shrink-0"
											style={{ backgroundColor: tag.color }}
										/>
										<span className="text-sm flex-1 truncate">{tag.name}</span>
										{selectedTagIds.includes(tag.id) && <Check className="h-4 w-4 text-primary" />}
									</button>
								))}
							</div>
							{selectedTagIds.length > 0 && (
								<>
									<div className="border-t my-2" />
									<button
										className="w-full text-sm text-muted-foreground hover:text-foreground text-center py-1"
										onClick={onClearAll}
									>
										Clear filters
									</button>
								</>
							)}
						</>
					)}
				</PopoverContent>
			</Popover>

			{selectedTags.length > 0 && (
				<TooltipProvider delayDuration={200}>
					<div className="flex items-center gap-1 flex-wrap max-w-[300px]">
						{selectedTags.map((tag) => (
							<Tooltip key={tag.id}>
								<TooltipTrigger asChild>
									<div className="max-w-[120px]">
										<TagBadge
											tag={tag}
											onRemove={() => onTagToggle(tag.id)}
											className="text-[10px] py-0.5 cursor-pointer [&>span]:truncate [&>span]:max-w-[80px]"
										/>
									</div>
								</TooltipTrigger>
								<TooltipContent side="top" className="text-xs">
									{tag.name}
								</TooltipContent>
							</Tooltip>
						))}
					</div>
				</TooltipProvider>
			)}
		</div>
	);
};
