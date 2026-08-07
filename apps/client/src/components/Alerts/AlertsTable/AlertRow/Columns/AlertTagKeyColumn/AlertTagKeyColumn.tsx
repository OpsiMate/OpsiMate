import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { CopyCellButton } from '../../CopyCellButton';

export interface AlertTagKeyColumnProps {
	alert: Alert;
	tagKey: string;
	// Wrap the full value onto new lines instead of truncating (the "expand rows" toggle).
	expanded?: boolean;
	className?: string;
	// Inline width for content-aware sizing; wins over any width class.
	style?: React.CSSProperties;
}

export const AlertTagKeyColumn = ({ alert, tagKey, expanded = false, className, style }: AlertTagKeyColumnProps) => {
	const value = alert.tags?.[tagKey];

	return (
		<TableCell style={style} className={cn('relative group/cell py-1 px-2 overflow-hidden', className)}>
			{value ? (
				<Badge
					variant="outline"
					className={cn(
						'text-xs px-1.5 py-0.5 max-w-full',
						expanded && 'rounded-md',
						// The badge's own font-semibold blocks the unread row's inherited
						// font-black; re-apply it so the WHOLE unread line reads bold.
						alert.isRead === false && 'font-black'
					)}
					title={expanded ? undefined : value}
				>
					{/* truncate must sit on a child of the badge's inline-flex container
					    for the ellipsis to render on long values; expanded wraps but
					    caps at 6 lines */}
					<span className={expanded ? 'break-all line-clamp-6' : 'truncate'}>{value}</span>
				</Badge>
			) : (
				<span className="text-foreground text-xs">-</span>
			)}
			{value && <CopyCellButton value={value} />}
		</TableCell>
	);
};
