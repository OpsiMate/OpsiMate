import { MttrDayPoint } from '@OpsiMate/shared';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDurationMs } from '../analytics.utils';
import { axisTick, ChartCard, tooltipStyle } from './chartTheme';

// Mean restore time per day — the trend behind the MTTR headline. Null-mean days
// (nothing resolved) simply have no point, which recharts renders as a gap.
export const MttrTrendChart = ({ data }: { data: MttrDayPoint[] }) => (
	<ChartCard title="MTTR trend" hint="Mean time to restore per day, over that day's resolutions">
		<ResponsiveContainer width="100%" height={220}>
			<LineChart data={data} margin={{ top: 4, right: 8, left: 2, bottom: 0 }}>
				<CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
				<XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} />
				<YAxis
					tick={axisTick}
					tickLine={false}
					axisLine={false}
					width={52}
					tickFormatter={(ms: number) => formatDurationMs(ms)}
				/>
				<Tooltip
					contentStyle={tooltipStyle}
					formatter={(value) => [formatDurationMs(value as number), 'MTTR']}
				/>
				<Line
					type="monotone"
					dataKey="meanMs"
					stroke="hsl(var(--primary))"
					strokeWidth={2}
					dot={{ r: 2.5, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
					connectNulls
				/>
			</LineChart>
		</ResponsiveContainer>
	</ChartCard>
);
