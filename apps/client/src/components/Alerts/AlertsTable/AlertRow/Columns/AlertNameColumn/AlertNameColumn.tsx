import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

export interface AlertNameColumnProps {
	alert: Alert;
	// Wrap the full name onto new lines instead of truncating (the "expand rows" toggle).
	expanded?: boolean;
	className?: string;
	// Inline width for content-aware sizing; wins over any width class.
	style?: React.CSSProperties;
}

export const AlertNameColumn = ({ alert, expanded = false, className, style }: AlertNameColumnProps) => {
	const isUnread = alert.isRead === false;
	return (
		<TableCell style={style} className={cn('py-1 px-2 overflow-hidden', className)}>
			<div className="flex items-start gap-1.5 min-w-0">
				{/* Unread dot: font weight alone is easy to miss when scanning, so unread
				    rows also get a filled dot before the name (the mail-client pattern).
				    mt-1.5 centers the 8px dot on the first 20px text line, so it stays
				    top-aligned when the expanded view wraps onto more lines. */}
				{isUnread && <span aria-hidden className="h-2 w-2 mt-1.5 rounded-full bg-primary shrink-0" />}
				<span
					className={cn(
						'text-sm block text-foreground min-w-0 flex-1',
						expanded ? 'whitespace-normal wrap-break-word line-clamp-6' : 'truncate',
						// Unread alerts: render the name at the heaviest weight so it clearly
						// outweighs the read rows (font-medium) instead of sitting a hair heavier.
						isUnread ? 'font-black' : 'font-medium'
					)}
					title={expanded ? undefined : alert.alertName}
				>
					{alert.alertName}
				</span>
			</div>
		</TableCell>
	);
};
