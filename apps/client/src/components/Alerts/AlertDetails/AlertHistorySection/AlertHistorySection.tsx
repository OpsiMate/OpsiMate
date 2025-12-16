import { Separator } from '@/components/ui/separator';
import { AlertHistory } from '@OpsiMate/shared';
import { AlertHistoryChart } from '../AlertHistoryChart';

interface AlertHistorySectionProps {
	historyData: AlertHistory;
}

export const AlertHistorySection = ({ historyData }: AlertHistorySectionProps) => {
	if (!historyData.data.length) {
		return null;
	}

	return (
		<>
			<Separator />
			<div>
				<div className="text-xs font-medium text-foreground mb-3">Alert History</div>
				<AlertHistoryChart historyData={historyData} />
			</div>
		</>
	);
};
