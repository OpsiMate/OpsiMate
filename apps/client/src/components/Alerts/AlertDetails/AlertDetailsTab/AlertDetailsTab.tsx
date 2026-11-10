import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert } from '@OpsiMate/shared';
import { AlertDetailsBody } from '../AlertDetailsBody';
import { AlertDetailsBottomSections } from '../AlertDetailsBottomSections';
import { SectionsExpandContext, SectionsExpandSignal } from '../CollapsibleSection';

interface AlertDetailsTabProps {
	alert: Alert;
	isResolved: boolean;
	// Switches to the Comments tab (containers with tabs only).
	onViewAllComments?: () => void;
	// The header's expand/collapse-all broadcast, delivered to every section below.
	signal: SectionsExpandSignal | null;
}

// The Details tab, shared by both containers (the tabbed panel and the plain details
// view): the body scrolls, the links/actions block stays pinned under it.
export const AlertDetailsTab = ({ alert, isResolved, onViewAllComments, signal }: AlertDetailsTabProps) => (
	<SectionsExpandContext.Provider value={signal}>
		<ScrollArea className="flex-1 min-h-0">
			<AlertDetailsBody alert={alert} onViewAllComments={onViewAllComments} isResolved={isResolved} />
		</ScrollArea>
		<AlertDetailsBottomSections alert={alert} />
	</SectionsExpandContext.Provider>
);
