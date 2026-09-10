import { HourVolumePoint } from '@OpsiMate/shared';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisTick, ChartCard, tooltipStyle } from './chartTheme';

// Hour-of-day histogram: "when do alerts hit us", in the viewer's timezone.
interface HourBarChartProps {
	data: HourVolumePoint[];
}

export const HourBarChart = ({ data }: HourBarChartProps) => {
	const max = Math.max(...data.map((d) => d.count), 1);
	return (
		<ChartCard title="Peak hours" hint="Firing episodes by hour of day (your timezone)">
			<ResponsiveContainer width="100%" height={240}>
				<BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
					<XAxis
						dataKey="hour"
						tick={axisTick}
						tickLine={false}
						axisLine={false}
						tickFormatter={(h: number) => `${String(h).padStart(2, '0')}`}
						interval={2}
					/>
					<YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
					<Tooltip
						contentStyle={tooltipStyle}
						labelFormatter={(h) => `${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59`}
					/>
					<Bar dataKey="count" radius={[3, 3, 0, 0]}>
						{data.map((point) => (
							// The busiest hours glow hotter — a mini heatmap without a second chart.
							<Cell
								key={point.hour}
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
