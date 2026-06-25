import { AlertHistory } from '@OpsiMate/shared';
import { History } from 'lucide-react';
import { useMemo } from 'react';
import { TimeRange } from '../../AlertsTable/TimeFilter/TimeFilter.types';
import { AlertHistoryTimeline } from '../AlertHistoryTimeline';
import { filterHistoryByRange } from '../AlertHistoryTimeline/alertHistory.utils';
import { CollapsibleSection } from '../CollapsibleSection';

interface AlertHistorySectionProps {
	historyData: AlertHistory;
	// The active time-range filter (the "All time" button). History is filtered to match it.
	timeRange?: TimeRange | null;
}

// Self-contained collapsible History section, rendered as a timeline and filtered by the
// active time range so it mirrors what the "All time" button shows for the alerts list.
export const AlertHistorySection = ({ historyData, timeRange }: AlertHistorySectionProps) => {
	const isFiltered = !!(timeRange && (timeRange.from || timeRange.to));
	const filtered = useMemo(() => filterHistoryByRange(historyData.data, timeRange), [historyData.data, timeRange]);

	if (!historyData.data.length) {
		return null;
	}

	return (
		<CollapsibleSection
			title="History"
			icon={<History className="h-3.5 w-3.5" />}
			badge={filtered.length}
			defaultOpen={false}
		>
			<AlertHistoryTimeline data={filtered} isFiltered={isFiltered} />
		</CollapsibleSection>
	);
};
