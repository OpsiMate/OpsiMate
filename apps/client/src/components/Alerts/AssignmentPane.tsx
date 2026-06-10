import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { cloneElement, isValidElement, ReactElement, ReactNode } from 'react';

type PaneTone = 'amber' | 'emerald';

const TONE_CLASS: Record<PaneTone, string> = {
	amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
	emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
};

// Compact "Title 428" caption rendered inside the table (via AlertsTable's `heading` prop)
// so the split panes don't need a separate header row above the table.
const PaneHeading = ({ title, count, tone }: { title: string; count: number; tone: PaneTone }) => (
	<>
		<span className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</span>
		<Badge variant="outline" className={cn('h-5 px-1.5 text-[11px]', TONE_CLASS[tone])}>
			{count}
		</Badge>
	</>
);

interface AssignmentPaneProps {
	title: string;
	count: number;
	tone: PaneTone;
	isEmpty?: boolean;
	emptyText?: string;
	/** An <AlertsTable /> element; the pane injects the heading caption into it. */
	children: ReactNode;
}

// One pane of the split-by-assignment view. When it has alerts it renders the table with the
// count caption injected; when empty it shows the same caption over a short message so both
// panes always stay labelled.
export const AssignmentPane = ({ title, count, tone, isEmpty, emptyText, children }: AssignmentPaneProps) => {
	const heading = <PaneHeading title={title} count={count} tone={tone} />;

	if (isEmpty) {
		return (
			<div className="h-full min-w-0 flex flex-col min-h-0 border rounded-lg overflow-hidden">
				<div className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0 bg-muted/30">{heading}</div>
				<div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
					{emptyText ?? 'No alerts.'}
				</div>
			</div>
		);
	}

	const table = isValidElement(children)
		? cloneElement(children as ReactElement<{ heading?: ReactNode }>, { heading })
		: children;

	return <div className="h-full min-w-0 flex flex-col min-h-0">{table}</div>;
};
