import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

export interface AlertTagKeyColumnProps {
	alert: Alert;
	tagKey: string;
	className?: string;
}

export const AlertTagKeyColumn = ({ alert, tagKey, className }: AlertTagKeyColumnProps) => {
	const value = alert.tags?.[tagKey];

	return (
		<TableCell className={cn('py-1 px-2 overflow-hidden', className)}>
			{value ? (
				<Badge variant="outline" className="text-xs px-1.5 py-0.5 max-w-full" title={value}>
					{/* truncate must sit on a child of the badge's inline-flex container
					    for the ellipsis to render on long values */}
					<span className="truncate">{value}</span>
				</Badge>
			) : (
				<span className="text-foreground text-xs">-</span>
			)}
		</TableCell>
	);
};
