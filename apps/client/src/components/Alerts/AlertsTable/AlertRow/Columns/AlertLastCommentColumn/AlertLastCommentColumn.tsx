import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { CopyCellButton } from '../../CopyCellButton';

export interface AlertLastCommentColumnProps {
	alert: Alert;
	// Wrap the full comment onto new lines instead of truncating (the "expand rows" toggle).
	expanded?: boolean;
	className?: string;
	// Inline width from the table\'s shared column-width map; wins over any width class.
	style?: React.CSSProperties;
}

// The alert's newest comment, mirroring the summary column's collapsed/expanded behavior;
// the full comment thread lives in the details panel's Comments tab.
export const AlertLastCommentColumn = ({ alert, expanded = false, className, style }: AlertLastCommentColumnProps) => {
	return (
		<TableCell style={style} className={cn('relative group/cell py-1 px-2 overflow-hidden', className)}>
			<span
				className={cn(
					'text-sm text-foreground block',
					expanded ? 'whitespace-normal wrap-break-word line-clamp-6' : 'truncate'
				)}
				title={alert.lastComment ?? undefined}
			>
				{alert.lastComment || '-'}
			</span>
			{alert.lastComment && <CopyCellButton value={alert.lastComment} />}
		</TableCell>
	);
};
