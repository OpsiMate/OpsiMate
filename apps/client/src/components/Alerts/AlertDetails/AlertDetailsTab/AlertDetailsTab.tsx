import { Alert } from '@OpsiMate/shared';
import { AlertDetailsBody } from '../AlertDetailsBody';
import { AlertDetailsBottomSections } from '../AlertDetailsBottomSections';
import { SectionsExpandContext, SectionsExpandSignal } from '../CollapsibleSection';
import { DETAILS_BODY_SCROLL_TEST_ID } from './AlertDetailsTab.constants';

interface AlertDetailsTabProps {
	alert: Alert;
	isResolved: boolean;
	// Switches to the Comments tab (containers with tabs only).
	onViewAllComments?: () => void;
	// The header's expand/collapse-all broadcast, delivered to every section below.
	signal: SectionsExpandSignal | null;
}

// The Details tab, shared by both containers (the tabbed panel and the plain details
// view): the body fills the room above the pinned links/actions block, its sections
// sharing the height (see AlertDetailsBody); only when even their floors do not fit (a
// very short window) does the body scroll as a whole.
export const AlertDetailsTab = ({ alert, isResolved, onViewAllComments, signal }: AlertDetailsTabProps) => (
	<SectionsExpandContext.Provider value={signal}>
		<div data-testid={DETAILS_BODY_SCROLL_TEST_ID} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
			<AlertDetailsBody alert={alert} onViewAllComments={onViewAllComments} isResolved={isResolved} />
		</div>
		<AlertDetailsBottomSections alert={alert} />
	</SectionsExpandContext.Provider>
);
