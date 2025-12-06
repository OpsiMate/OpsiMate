import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';
import { Alert } from '@OpsiMate/shared';
import { getTagKeyColor } from '../../../../utils/tagColors.utils';

export interface AlertTagKeyColumnProps {
	alert: Alert;
	tagKey: string;
}

export const AlertTagKeyColumn = ({ alert, tagKey }: AlertTagKeyColumnProps) => {
	const value = alert.tags?.[tagKey];
	const colors = value ? getTagKeyColor(tagKey) : undefined;

	return (
		<TableCell className="py-1 px-2">
			{value && colors ? (
				<Badge
					className="text-xs px-1.5 py-0.5 border-0"
					style={{
						backgroundColor: colors.background,
						color: colors.text,
					}}
				>
					{value}
				</Badge>
			) : (
				<span className="text-muted-foreground text-xs">-</span>
			)}
		</TableCell>
	);
};
