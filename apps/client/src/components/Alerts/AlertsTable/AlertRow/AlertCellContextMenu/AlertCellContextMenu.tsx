import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { Alert } from '@OpsiMate/shared';
import { Copy } from 'lucide-react';
import { CELL_COPY_LABELS, COPY_PREVIEW_MAX_CHARS } from '../AlertRow.constants';
import { previewValue } from '../AlertRow.utils';

interface AlertCellContextMenuProps {
	alert: Alert;
	// The full value of the cell that was right-clicked; null when the click was not on a
	// copyable cell (icons, actions, the checkbox).
	cellValue: string | null;
}

// What a right-click on an alert row offers: copy the clicked cell's value, and the
// alert's headline fields — a selection-free way to copy for people who used to drag
// across the cell text, which now drags the row.
export const AlertCellContextMenu = ({ alert, cellValue }: AlertCellContextMenuProps) => {
	const { copy } = useCopyToClipboard();
	const copyWithToast = (value: string, what: string) =>
		copy(value, { successDescription: CELL_COPY_LABELS.copied(what), failureDescription: what });
	const summary = alert.summary?.trim() || null;
	return (
		<ContextMenuContent className="min-w-48">
			{cellValue !== null && (
				<>
					<ContextMenuItem
						onSelect={() => copyWithToast(cellValue, previewValue(cellValue, COPY_PREVIEW_MAX_CHARS))}
					>
						<Copy className="mr-2 h-3.5 w-3.5 shrink-0" />
						<span className="flex min-w-0 flex-col">
							<span>{CELL_COPY_LABELS.value}</span>
							<span className="truncate text-xs text-muted-foreground">
								{previewValue(cellValue, COPY_PREVIEW_MAX_CHARS)}
							</span>
						</span>
					</ContextMenuItem>
					<ContextMenuSeparator />
				</>
			)}
			<ContextMenuItem onSelect={() => copyWithToast(alert.alertName, 'Alert name')}>
				<Copy className="mr-2 h-3.5 w-3.5 shrink-0" />
				{CELL_COPY_LABELS.alertName}
			</ContextMenuItem>
			{summary && (
				<ContextMenuItem onSelect={() => copyWithToast(summary, 'Summary')}>
					<Copy className="mr-2 h-3.5 w-3.5 shrink-0" />
					{CELL_COPY_LABELS.summary}
				</ContextMenuItem>
			)}
		</ContextMenuContent>
	);
};
