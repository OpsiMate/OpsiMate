import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getContrastColor } from '@/lib/colors';
import { Tag } from '@OpsiMate/shared';

interface TagBadgeProps {
	tag: Tag;
	onRemove?: () => void;
	className?: string;
}

export const TagBadge = ({ tag, onRemove, className }: TagBadgeProps) => {
	return (
		<Badge
			className={cn('inline-flex items-center gap-1 px-2 py-1 text-xs font-medium', className)}
			style={{
				backgroundColor: tag.color,
				color: getContrastColor(tag.color),
				border: `1px solid ${tag.color}`,
			}}
		>
			<span>{tag.name}</span>
			{onRemove && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
					className="ml-1 hover:bg-black/10 rounded-full p-0.5"
				>
					<X className="h-3 w-3" />
				</button>
			)}
		</Badge>
	);
};
