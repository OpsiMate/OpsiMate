import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

interface SectionsExpandControlsProps {
	// Fired with true for "Expand all", false for "Collapse all".
	onBroadcast: (open: boolean) => void;
}

// The "Expand all" / "Collapse all" button pair for a stack of CollapsibleSections. The
// parent owns the SectionsExpandSignal state and provides it via SectionsExpandContext.
export const SectionsExpandControls = ({ onBroadcast }: SectionsExpandControlsProps) => (
	<div className="flex items-center justify-end gap-3">
		<button
			type="button"
			onClick={() => onBroadcast(true)}
			className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
		>
			<ChevronsUpDown className="h-3 w-3" />
			Expand all
		</button>
		<button
			type="button"
			onClick={() => onBroadcast(false)}
			className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
		>
			<ChevronsDownUp className="h-3 w-3" />
			Collapse all
		</button>
	</div>
);
