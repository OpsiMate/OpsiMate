import { stripHtml } from '@/components/shared';
import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { CopyCellButton } from '../../CopyCellButton';

export interface AlertSummaryColumnProps {
	alert: Alert;
	// Wrap the full summary onto new lines instead of truncating (the "expand rows" toggle).
	expanded?: boolean;
	className?: string;
	// Inline width from the table\'s shared column-width map; wins over any width class.
	style?: React.CSSProperties;
}

export const AlertSummaryColumn = ({ alert, expanded = false, className, style }: AlertSummaryColumnProps) => {
	// The cell renders formatted summaries as plain text; the full formatting shows in
	// the details panel. Collapsed it is a single truncated line; expanded it wraps but
	// is capped at 6 lines (line-clamp) so one huge summary can't fill the viewport.
	return (
		<TableCell style={style} className={cn('relative group/cell py-1 px-2 overflow-hidden', className)}>
			<span
				className={cn(
					'text-sm text-foreground block',
					expanded ? 'whitespace-normal wrap-break-word line-clamp-6' : 'truncate'
				)}
			>
				{alert.summary ? stripHtml(alert.summary) : '-'}
			</span>
			{alert.summary && <CopyCellButton value={stripHtml(alert.summary)} />}
		</TableCell>
	);
};
