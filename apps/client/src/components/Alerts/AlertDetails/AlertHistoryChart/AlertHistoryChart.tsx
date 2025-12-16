import { AlertHistory, AlertStatus } from '@OpsiMate/shared';
import { format } from 'date-fns';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface AlertHistoryChartProps {
	historyData: AlertHistory;
}

export const AlertHistoryChart = ({ historyData }: AlertHistoryChartProps) => {
	const chartData = historyData.data.map((item, index) => ({
		...item,
		statusValue: item.status === AlertStatus.FIRING ? 1 : 0,
		index,
	}));

	return (
		<ResponsiveContainer width="100%" height={150}>
			<LineChart data={chartData}>
				<CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
				<XAxis
					dataKey="date"
					tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
					tickFormatter={(value) => format(new Date(value), 'MM/dd HH:mm')}
					stroke="hsl(var(--border))"
				/>
				<YAxis
					domain={[0, 1]}
					ticks={[0, 1]}
					tickFormatter={(value) => (value === 1 ? 'Firing' : 'Resolved')}
					tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
					stroke="hsl(var(--border))"
				/>
				<Tooltip
					labelFormatter={(value) => format(new Date(value), 'PPpp')}
					contentStyle={{
						fontSize: '12px',
						backgroundColor: 'hsl(var(--background))',
						border: '1px solid hsl(var(--border))',
						borderRadius: '6px',
					}}
					formatter={(value: number, name: string) => {
						if (name === 'statusValue') {
							return [value === 1 ? 'Firing' : 'Resolved', 'Status'];
						}
						return [value, name];
					}}
				/>
				<Line
					type="stepAfter"
					dataKey="statusValue"
					stroke="hsl(var(--primary))"
					strokeWidth={2}
					dot={{ r: 4, fill: 'hsl(var(--primary))' }}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
};
