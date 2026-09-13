import { WeekdayVolumePoint } from '@OpsiMate/shared';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisTick, ChartCard, tooltipStyle } from './chartTheme';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Day-of-week histogram — "is Monday really the worst".
interface WeekdayBarChartProps {
	data: WeekdayVolumePoint[];
}

export const WeekdayBarChart = ({ data }: WeekdayBarChartProps) => {
	const max = Math.max(...data.map((d) => d.count), 1);
	return (
		<ChartCard title="Busiest days" hint="Firing episodes by day of week (your timezone)">
			<ResponsiveContainer width="100%" height={240}>
				<BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
					<XAxis
						dataKey="weekday"
						tick={axisTick}
						tickLine={false}
						axisLine={false}
						tickFormatter={(d: number) => WEEKDAY_LABELS[d] ?? ''}
					/>
					<YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
					<Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => WEEKDAY_LABELS[d as number] ?? ''} />
					<Bar dataKey="count" radius={[3, 3, 0, 0]}>
						{data.map((point) => (
							<Cell
								key={point.weekday}
								fill="hsl(var(--primary))"
								fillOpacity={0.25 + 0.75 * (point.count / max)}
							/>
						))}
					</Bar>
				</BarChart>
			</ResponsiveContainer>
		</ChartCard>
	);
};
