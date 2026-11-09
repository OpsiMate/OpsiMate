import { Alert as SharedAlert } from '@OpsiMate/shared';
import { FileText, Link2, PhoneCall } from 'lucide-react';
import { AlertActionsSection } from '../AlertActionsSection';
import { AlertInfoSection } from '../AlertInfoSection';
import { AlertLastCommentSection } from '../AlertLastCommentSection';
import { AlertRootCauseSection } from '../AlertRootCauseSection';
import { AlertLinksSection } from '../AlertLinksSection';
import { getAlertLinks } from '../../utils/links.utils';
import { AlertSummarySection } from '../AlertSummarySection';
import { AlertTeamSection } from '../AlertTeamSection';
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
// sections (summary, team, root cause, latest comment, links) followed by the
// custom-actions section. History has its own tab (AlertHistoryWall)
// and the silence/resolve buttons are NOT part of the body — containers pin them at the
// bottom via AlertFooterActions.
export const AlertDetailsBody = ({ alert, onViewAllComments, isResolved }: AlertDetailsBodyProps) => {
	return (
		<div className="p-4 space-y-2">
			<AlertInfoSection alert={alert} isResolved={isResolved} />

			{alert.summary && (
				<CollapsibleSection title="Summary" icon={<FileText className="h-3.5 w-3.5" />} defaultOpen>
					<AlertSummarySection summary={alert.summary} />
				</CollapsibleSection>
			)}

			{alert.team && (
				<CollapsibleSection title="Team" icon={<PhoneCall className="h-3.5 w-3.5" />} defaultOpen={false}>
					<AlertTeamSection team={alert.team} />
				</CollapsibleSection>
			)}

			<AlertRootCauseSection alertId={alert.id} />

			<AlertLastCommentSection alertId={alert.id} onViewAll={onViewAllComments} />

			{getAlertLinks(alert).length > 0 && (
				<CollapsibleSection title="Links" icon={<Link2 className="h-3.5 w-3.5" />} defaultOpen={false}>
					<AlertLinksSection alert={alert} />
				</CollapsibleSection>
			)}

			<AlertActionsSection alert={alert} />
		</div>
	);
};
