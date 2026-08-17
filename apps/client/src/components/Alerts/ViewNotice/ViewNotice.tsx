import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { ReactNode } from 'react';

interface ViewNoticeProps {
	// Leading icon, sized by the caller (h-3.5 w-3.5).
	icon: ReactNode;
	// The sentence. Always rendered on ONE line: anything longer is ellipsised rather
	// than wrapped, so the strip can never grow into the table's space no matter how
	// many filters are on.
	children: ReactNode;
	// Hover text carrying the FULL content, since the visible line may be truncated.
	title?: string;
	actionLabel: string;
	onAction: () => void;
}

// The strip above the table that says "this view is narrower than it looks". Extracted
// from the free-text search notice so an added-filters notice is literally the same UI
// rather than a lookalike that drifts.
export const ViewNotice = ({ icon, children, title, actionLabel, onAction }: ViewNoticeProps) => {
	return (
		<div className="mt-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm">
			<span className="shrink-0 text-primary">{icon}</span>
			{/* min-w-0 is what lets truncate actually bite inside a flex row. */}
			<span className="min-w-0 flex-1 truncate" title={title}>
				{children}
			</span>
			<Button variant="ghost" size="sm" onClick={onAction} className="ml-auto h-6 shrink-0 gap-1 px-2 text-xs">
				<X className="h-3 w-3" />
				{actionLabel}
			</Button>
		</div>
	);
};
