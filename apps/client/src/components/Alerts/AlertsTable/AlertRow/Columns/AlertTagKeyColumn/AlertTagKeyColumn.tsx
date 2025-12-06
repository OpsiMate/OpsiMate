import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';
import { Alert } from '@OpsiMate/shared';

export interface AlertTagKeyColumnProps {
	alert: Alert;
	tagKey: string;
}

export const AlertTagKeyColumn = ({ alert, tagKey }: AlertTagKeyColumnProps) => {
	const value = alert.tags?.[tagKey];

	return (
		<TableCell className="py-1 px-2">
			{value ? (
				<Badge variant="outline" className="text-xs px-1.5 py-0.5">
					{value}
				</Badge>
			) : (
				<span className="text-muted-foreground text-xs">-</span>
			)}
		</TableCell>
	);
};
