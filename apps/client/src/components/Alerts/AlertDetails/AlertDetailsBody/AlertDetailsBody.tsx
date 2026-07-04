import { AlertHistory, Alert as SharedAlert } from '@OpsiMate/shared';
import { Clock, FileText, Link2, Tag } from 'lucide-react';
import { useState } from 'react';
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
import {
	CollapsibleSection,
	SectionsExpandContext,
	SectionsExpandControls,
	SectionsExpandSignal,
} from '../CollapsibleSection';

interface AlertDetailsBodyProps {
	alert: SharedAlert;
	isActive: boolean;
	historyData: AlertHistory | null;
	// Active time-range filter, passed through to the History section.
	timeRange?: TimeRange | null;
	onDismiss?: (alertId: string) => void;
	onUndismiss?: (alertId: string) => void;
	onDelete?: (alertId: string) => void;
	// Switches to the Comments tab (containers with tabs only).
	onViewAllComments?: () => void;
}

// The Details-tab body, shared by all alert-detail containers. Identity stays pinned at the
// top; everything else lives in collapsible sections (summary, latest comment, history,
// labels, links) followed by the actions section.
export const AlertDetailsBody = ({
	alert,
	isActive,
	historyData,
	timeRange,
	onDismiss,
	onUndismiss,
	onDelete,
	onViewAllComments,
}: AlertDetailsBodyProps) => {
	const [expandSignal, setExpandSignal] = useState<SectionsExpandSignal | null>(null);
	const broadcast = (open: boolean) => setExpandSignal((prev) => ({ open, token: (prev?.token ?? 0) + 1 }));

	return (
		<div className="p-4 space-y-2">
			<AlertInfoSection alert={alert} />

			<SectionsExpandControls onBroadcast={broadcast} />

			<SectionsExpandContext.Provider value={expandSignal}>
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
			</SectionsExpandContext.Provider>

			<AlertActionsSection
				alert={alert}
				isActive={isActive}
				onDismiss={onDismiss}
				onUndismiss={onUndismiss}
				onDelete={onDelete}
			/>
		</div>
	);
};
