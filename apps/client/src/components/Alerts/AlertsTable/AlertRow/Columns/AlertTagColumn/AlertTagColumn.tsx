import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';
import { Alert } from '@OpsiMate/shared';

export interface AlertTagColumnProps {
	alert: Alert;
}

export const AlertTagColumn = ({ alert }: AlertTagColumnProps) => {
	return (
		<TableCell className="py-1 px-2">
			{alert.tag ? (
				<Badge variant="outline" className="text-xs px-1.5 py-0.5">
					{alert.tag}
				</Badge>
			) : (
				<span className="text-muted-foreground text-xs">-</span>
			)}
		</TableCell>
	);
};
