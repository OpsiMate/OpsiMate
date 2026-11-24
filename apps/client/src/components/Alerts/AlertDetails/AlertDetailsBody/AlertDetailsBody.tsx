import { Alert as SharedAlert } from '@OpsiMate/shared';
import { FileText } from 'lucide-react';
import { AlertInfoSection } from '../AlertInfoSection';
import { AlertLastCommentSection } from '../AlertLastCommentSection';
import { AlertRootCauseSection } from '../AlertRootCauseSection';
import { AlertSummarySection } from '../AlertSummarySection';
import { CollapsibleSection } from '../CollapsibleSection';

interface AlertDetailsBodyProps {
	alert: SharedAlert;
	// Switches to the Comments tab (containers with tabs only).
	onViewAllComments?: () => void;
	// The alert is in the resolved list (see AlertInfoSection).
	isResolved?: boolean;
}

// The Details-tab body, shared by all alert-detail containers. Identity stays pinned at the
// top (labels and the id live behind its tag icon); everything else lives in collapsible
// sections (summary, root cause, latest comment); the owning team is a chip in the owner
// row (AlertTeamPopover). The body is a flex column that fills the tab: the summary and
// the root cause take their content's height while there is room and split the room
// (scrolling inside) when there is not — alone, the summary gets most of the panel; next
// to a root cause and a comment, its share. No dead space either way. Links and custom actions are NOT
// part of the body either: containers pin them under it (AlertDetailsBottomSections),
// above the silence/resolve footer (AlertFooterActions). History has its own tab.
export const AlertDetailsBody = ({ alert, onViewAllComments, isResolved }: AlertDetailsBodyProps) => {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
			<div className="shrink-0">
				<AlertInfoSection alert={alert} isResolved={isResolved} />
			</div>

			{alert.summary && (
				<CollapsibleSection title="Summary" icon={<FileText className="h-3.5 w-3.5" />} defaultOpen fill>
					<AlertSummarySection summary={alert.summary} />
				</CollapsibleSection>
			)}

			<AlertRootCauseSection alertId={alert.id} />

			<AlertLastCommentSection alertId={alert.id} onViewAll={onViewAllComments} />
		</div>
	);
};
