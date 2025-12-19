import { AlertHistory, AlertStatus } from '@OpsiMate/shared';
import { format } from 'date-fns';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface AlertHistoryChartProps {
	historyData: AlertHistory;
}

const formatFullDate = (dateStr: string) => {
	const date = new Date(dateStr);
	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
};

export const AlertHistoryChart = ({ historyData }: AlertHistoryChartProps) => {
	return (
		<div className="border border-border rounded-lg bg-background">
			<div className="overflow-y-auto max-h-[300px]">
				{historyData.data.map((item, index) => {
					const isFiring = item.status === AlertStatus.FIRING;
					return (
						<div
							key={index}
							className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
						>
							<div
								className={`w-3 h-3 rounded-full flex-shrink-0 ${
									isFiring
										? 'bg-red-500 border-2 border-red-600'
										: 'bg-green-500 border-2 border-green-600'
								}`}
							/>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-3 flex-wrap">
									<span
										className={`font-medium text-sm ${
											isFiring ? 'text-red-500' : 'text-green-500'
										}`}
									>
										{isFiring ? 'Firing' : 'Resolved'}
									</span>
									<span className="text-xs text-muted-foreground">{formatFullDate(item.date)}</span>
								</div>
							</div>
						</div>
					);
				})}
			</div>
			{historyData.data.length === 0 && (
				<div className="px-4 py-8 text-center text-sm text-muted-foreground">No alert history available</div>
			)}
		</div>
	);
};
