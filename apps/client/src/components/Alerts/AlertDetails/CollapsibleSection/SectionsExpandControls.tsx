import { Button } from '@/components/ui/button';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

interface SectionsExpandControlsProps {
	// Fired with true for "Expand all", false for "Collapse all".
	onBroadcast: (open: boolean) => void;
}

// Compact icon-only "Expand all" / "Collapse all" pair, sized to sit in a header bar next
// to the close button. The parent owns the SectionsExpandSignal state and provides it via
// SectionsExpandContext.
export const SectionsExpandControls = ({ onBroadcast }: SectionsExpandControlsProps) => (
	<>
		<Button
			variant="ghost"
			size="icon"
			className="h-8 w-8 text-muted-foreground hover:text-foreground"
			onClick={() => onBroadcast(true)}
			aria-label="Expand all sections"
			title="Expand all sections"
		>
			<ChevronsUpDown className="h-4 w-4" />
		</Button>
		<Button
			variant="ghost"
			size="icon"
			className="h-8 w-8 text-muted-foreground hover:text-foreground"
			onClick={() => onBroadcast(false)}
			aria-label="Collapse all sections"
			title="Collapse all sections"
		>
			<ChevronsDownUp className="h-4 w-4" />
		</Button>
	</>
);
