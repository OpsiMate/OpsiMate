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
				<Badge variant="outline" className="text-xs px-1.5 py-0.5 max-w-full truncate" title={value}>
					{value}
				</Badge>
			) : (
				<span className="text-foreground text-xs">-</span>
			)}
		</TableCell>
	);
};
