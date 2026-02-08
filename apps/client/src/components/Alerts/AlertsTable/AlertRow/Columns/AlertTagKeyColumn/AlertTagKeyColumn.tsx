import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { getTagKeyColor } from '../../../../utils/tagColors.utils';

export interface AlertTagKeyColumnProps {
	alert: Alert;
	tagKey: string;
	className?: string;
}

export const AlertTagKeyColumn = ({ alert, tagKey, className }: AlertTagKeyColumnProps) => {
	const value = alert.tags?.[tagKey];
	const colors = value ? getTagKeyColor(tagKey) : undefined;

	return (
		<TableCell className={cn('py-1 px-2 overflow-hidden', className)}>
			{value && colors ? (
				<Badge
					className="text-xs px-1.5 py-0.5 border-0 max-w-full truncate"
					style={{
						backgroundColor: colors.background,
						color: colors.text,
					}}
					title={value}
				>
					{value}
				</Badge>
			) : (
				<span className="text-foreground text-xs">-</span>
			)}
		</TableCell>
	);
};
