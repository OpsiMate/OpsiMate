import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { ReactNode } from 'react';

export interface ViewNoticeAction {
	label: string;
	onClick: () => void;
}

interface ViewNoticeProps {
	// Leading icon, sized by the caller (h-3.5 w-3.5).
	icon: ReactNode;
	// The sentence. Always rendered on ONE line: anything longer is ellipsised rather
	// than wrapped, so the strip can never grow into the table's space no matter how
	// much is on.
	children: ReactNode;
	// Hover text carrying the FULL content, since the visible line may be truncated.
	title?: string;
	// One button per way out. Search and filters share a single strip rather than
	// stacking two, so both can appear here — each still clearable on its own.
	actions: ViewNoticeAction[];
}

// The strip above the table that says "this view is narrower than it looks". One strip
// for every reason at once: two stacked notices cost twice the vertical space and read
// as two unrelated warnings when they describe one narrowed view.
export const ViewNotice = ({ icon, children, title, actions }: ViewNoticeProps) => {
	return (
		<div className="mt-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm">
			<span className="shrink-0 text-primary">{icon}</span>
			{/* min-w-0 is what lets truncate actually bite inside a flex row. */}
			<span className="min-w-0 flex-1 truncate" title={title}>
				{children}
			</span>
			<span className="ml-auto flex shrink-0 items-center gap-1">
				{actions.map((action) => (
					<Button
						key={action.label}
						variant="ghost"
						size="sm"
						onClick={action.onClick}
						className="h-6 shrink-0 gap-1 px-2 text-xs"
					>
						<X className="h-3 w-3" />
						{action.label}
					</Button>
				))}
			</span>
		</div>
	);
};
