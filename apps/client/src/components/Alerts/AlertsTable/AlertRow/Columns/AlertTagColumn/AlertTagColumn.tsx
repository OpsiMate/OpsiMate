import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';
import { Alert } from '@OpsiMate/shared';
import { getAlertTagsArray, hasAlertTags } from '../../../../utils/alertTags.utils';

export interface AlertTagColumnProps {
	alert: Alert;
}

export const AlertTagColumn = ({ alert }: AlertTagColumnProps) => {
	const tags = getAlertTagsArray(alert);

	return (
		<TableCell className="py-1 px-2">
			{hasAlertTags(alert) ? (
				<div className="flex flex-wrap gap-1">
					{tags.map((tag, index) => (
						<Badge key={index} variant="outline" className="text-xs px-1.5 py-0.5">
							{tag}
						</Badge>
					))}
				</div>
			) : (
				<span className="text-muted-foreground text-xs">-</span>
			)}
		</TableCell>
	);
};
