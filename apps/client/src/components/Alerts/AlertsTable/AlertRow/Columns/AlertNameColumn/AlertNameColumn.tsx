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
	return (
		<TableCell style={style} className={cn('py-1 px-2 overflow-hidden', className)}>
			<span
				className={cn(
					'text-sm block text-foreground',
					expanded ? 'whitespace-normal wrap-break-word line-clamp-6' : 'truncate',
					// Unread alerts: extra-bold the name so it clearly outweighs the read rows
					// (font-medium) instead of sitting just a hair heavier.
					alert.isRead === false ? 'font-extrabold' : 'font-medium'
				)}
				title={expanded ? undefined : alert.alertName}
			>
				{alert.alertName}
			</span>
		</TableCell>
	);
};
