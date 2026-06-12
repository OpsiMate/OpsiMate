import { stripHtml } from '@/components/shared';
import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

export interface AlertSummaryColumnProps {
	alert: Alert;
	className?: string;
}

export const AlertSummaryColumn = ({ alert, className }: AlertSummaryColumnProps) => {
	// The cell is a single truncated line, so render formatted summaries as plain text here;
	// the full formatting shows in the details panel.
	return (
		<TableCell className={cn('py-1 px-2 overflow-hidden', className)}>
			<span className="text-sm text-foreground truncate block">
				{alert.summary ? stripHtml(alert.summary) : '-'}
			</span>
		</TableCell>
	);
};
