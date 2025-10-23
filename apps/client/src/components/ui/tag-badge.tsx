import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
					onClick={e => {
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

// Helper function to determine text color based on background color
function getContrastColor(hexColor: string): string {
	// Remove the # if present
	const hex = hexColor.replace('#', '');

	// Convert to RGB
	const r = parseInt(hex.substr(0, 2), 16);
	const g = parseInt(hex.substr(2, 2), 16);
	const b = parseInt(hex.substr(4, 2), 16);

	// Calculate luminance
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

	// Return black or white based on luminance
	return luminance > 0.5 ? '#000000' : '#ffffff';
}
