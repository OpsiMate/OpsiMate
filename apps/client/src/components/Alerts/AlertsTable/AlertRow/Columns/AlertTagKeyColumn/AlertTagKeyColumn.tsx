import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

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
		<TableCell style={style} className={cn('py-1 px-2 overflow-hidden', className)}>
			{value ? (
				<Badge
					variant="outline"
					className={cn('text-xs px-1.5 py-0.5 max-w-full', expanded && 'rounded-md')}
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
		</TableCell>
	);
};
