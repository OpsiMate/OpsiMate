import { stripHtml } from '@/components/shared';
import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

export interface AlertSummaryColumnProps {
	alert: Alert;
	// Wrap the full summary onto new lines instead of truncating (the "expand rows" toggle).
	expanded?: boolean;
	className?: string;
}

export const AlertSummaryColumn = ({ alert, expanded = false, className }: AlertSummaryColumnProps) => {
	// The cell renders formatted summaries as plain text; the full formatting shows in
	// the details panel. Collapsed it is a single truncated line, expanded it wraps.
	return (
		<TableCell className={cn('py-1 px-2 overflow-hidden', className)}>
			<span
				className={cn('text-sm text-foreground block', expanded ? 'whitespace-normal break-words' : 'truncate')}
			>
				{alert.summary ? stripHtml(alert.summary) : '-'}
			</span>
		</TableCell>
	);
};
