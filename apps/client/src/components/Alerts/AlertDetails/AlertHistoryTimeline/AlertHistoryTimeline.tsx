import { AlertHistory, AlertStatus } from '@OpsiMate/shared';

interface AlertHistoryTimelineProps {
	historyData: AlertHistory;
}

const formatFullDate = (dateStr: string) =>
	new Date(dateStr).toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

// Vertical timeline view of the alert's status history: a connector line with a colored node
// per transition. Most recent first (matching the list view).
export const AlertHistoryTimeline = ({ historyData }: AlertHistoryTimelineProps) => {
	if (!historyData.data.length) {
		return <div className="px-4 py-6 text-center text-sm text-muted-foreground">No alert history available</div>;
	}

	return (
		<div className="border border-border rounded-lg bg-background overflow-y-auto max-h-[300px] p-4">
			<ol className="relative">
				{historyData.data.map((item, index) => {
					const isFiring = item.status === AlertStatus.FIRING;
					const isLast = index === historyData.data.length - 1;
					return (
						<li key={index} className="relative flex gap-3 pb-4 last:pb-0">
							{/* connector line */}
							{!isLast && <span className="absolute left-[5px] top-3 bottom-0 w-px bg-border" />}
							{/* node */}
							<span
								className={`relative z-10 mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ring-2 ring-background ${
									isFiring ? 'bg-red-500' : 'bg-green-500'
								}`}
							/>
							<div className="flex-1 min-w-0 -mt-0.5">
								<div className={`text-sm font-medium ${isFiring ? 'text-red-500' : 'text-green-500'}`}>
									{isFiring ? 'Firing' : 'Resolved'}
								</div>
								<div className="text-xs text-muted-foreground">{formatFullDate(item.date)}</div>
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
};
