import { AlertHistoryTimeline } from '../../AlertDetails/AlertHistoryTimeline';
import { useMergedIncidentHistory } from '../useMergedIncidentHistory';

interface IncidentMergedHistoryProps {
	alertIds: string[];
}

// Mounted only while the History section is expanded — CollapsibleSection renders its
// children only when open, so the N per-member history requests wait for the user to
// actually ask for the timeline.
export const IncidentMergedHistory = ({ alertIds }: IncidentMergedHistoryProps) => {
	const mergedHistory = useMergedIncidentHistory(alertIds);
	return <AlertHistoryTimeline data={mergedHistory} />;
};
