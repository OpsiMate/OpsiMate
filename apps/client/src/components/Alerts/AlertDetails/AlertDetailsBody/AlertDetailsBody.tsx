import { AlertHistory, Alert as SharedAlert } from '@OpsiMate/shared';
import { Clock, FileText, Link2, Tag } from 'lucide-react';
import { TimeRange } from '../../AlertsTable/TimeFilter/TimeFilter.types';
import { hasAlertTags } from '../../utils/alertTags.utils';
import { AlertActionsSection } from '../AlertActionsSection';
import { AlertHistorySection } from '../AlertHistorySection';
import { AlertInfoSection } from '../AlertInfoSection';
import { AlertLastCommentSection } from '../AlertLastCommentSection';
import { AlertLinksSection } from '../AlertLinksSection';
import { AlertSummarySection } from '../AlertSummarySection';
import { AlertTagsSection } from '../AlertTagsSection';
import { AlertTimestampsSection } from '../AlertTimestampsSection';
import { CollapsibleSection } from '../CollapsibleSection';

interface AlertDetailsBodyProps {
	alert: SharedAlert;
	historyData: AlertHistory | null;
	// Active time-range filter, passed through to the History section.
	timeRange?: TimeRange | null;
	// Switches to the Comments tab (containers with tabs only).
	onViewAllComments?: () => void;
}

// The Details-tab body, shared by all alert-detail containers. Identity stays pinned at the
// top; everything else lives in collapsible sections (summary, latest comment, history,
// labels, links) followed by the custom-actions section. The silence/resolve buttons are
// NOT part of the body — containers pin them at the bottom via AlertFooterActions.
export const AlertDetailsBody = ({ alert, historyData, timeRange, onViewAllComments }: AlertDetailsBodyProps) => {
	return (
		<div className="p-4 space-y-2">
			<AlertInfoSection alert={alert} />

			{alert.summary && (
				<CollapsibleSection title="Summary" icon={<FileText className="h-3.5 w-3.5" />} defaultOpen>
					<AlertSummarySection summary={alert.summary} />
				</CollapsibleSection>
			)}

			<AlertLastCommentSection alertId={alert.id} onViewAll={onViewAllComments} />

			{historyData && historyData.data.length > 0 && (
				<AlertHistorySection historyData={historyData} timeRange={timeRange} />
			)}

			{hasAlertTags(alert) && (
				<CollapsibleSection title="Labels" icon={<Tag className="h-3.5 w-3.5" />} defaultOpen={false}>
					<AlertTagsSection alert={alert} />
				</CollapsibleSection>
			)}

			<CollapsibleSection title="Timestamps" icon={<Clock className="h-3.5 w-3.5" />} defaultOpen={false}>
				<AlertTimestampsSection alert={alert} />
			</CollapsibleSection>

			{(alert.alertUrl || alert.runbookUrl) && (
				<CollapsibleSection title="Links" icon={<Link2 className="h-3.5 w-3.5" />} defaultOpen={false}>
					<AlertLinksSection alert={alert} />
				</CollapsibleSection>
			)}

			<AlertActionsSection alert={alert} />
		</div>
	);
};
