import { AlertHistory } from '@OpsiMate/shared';
import { History } from 'lucide-react';
import { AlertHistoryTimeline } from '../AlertHistoryTimeline';
import { CollapsibleSection } from '../CollapsibleSection';

interface AlertHistorySectionProps {
	historyData: AlertHistory;
}

// Self-contained collapsible History section, rendered as a timeline.
export const AlertHistorySection = ({ historyData }: AlertHistorySectionProps) => {
	if (!historyData.data.length) {
		return null;
	}

	return (
		<CollapsibleSection
			title="History"
			icon={<History className="h-3.5 w-3.5" />}
			badge={historyData.data.length}
			defaultOpen={false}
		>
			<AlertHistoryTimeline historyData={historyData} />
		</CollapsibleSection>
	);
};
