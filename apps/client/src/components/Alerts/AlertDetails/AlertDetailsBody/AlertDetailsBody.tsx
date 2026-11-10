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
// row (AlertTeamPopover). Links and custom actions are NOT
// part of the body either: containers pin them under it (AlertDetailsBottomSections),
// above the silence/resolve footer (AlertFooterActions). History has its own tab.
export const AlertDetailsBody = ({ alert, onViewAllComments, isResolved }: AlertDetailsBodyProps) => {
	return (
		<div className="p-4 space-y-2">
			<AlertInfoSection alert={alert} isResolved={isResolved} />

			{alert.summary && (
				<CollapsibleSection title="Summary" icon={<FileText className="h-3.5 w-3.5" />} defaultOpen>
					<AlertSummarySection summary={alert.summary} />
				</CollapsibleSection>
			)}

			<AlertRootCauseSection alertId={alert.id} />

			<AlertLastCommentSection alertId={alert.id} onViewAll={onViewAllComments} />
		</div>
	);
};
