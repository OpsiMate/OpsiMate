import { DayVolumePoint } from '@OpsiMate/shared';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SEVERITY_COLORS } from '../analytics.utils';
import { axisTick, ChartCard, tooltipStyle } from './chartTheme';

// Alert volume per day, stacked by severity, with the day's resolutions overlaid as a
// dashed line — the "are we keeping up" read at a glance.
interface VolumeAreaChartProps {
	data: DayVolumePoint[];
}

export const VolumeAreaChart = ({ data }: VolumeAreaChartProps) => (
	<ChartCard title="Alert volume" hint="Firing episodes per day by severity; dashed line = resolutions">
		<ResponsiveContainer width="100%" height={240}>
			<ComposedChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
				<CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
				<XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} />
				<YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
				<Tooltip contentStyle={tooltipStyle} />
				<Area
					type="monotone"
					dataKey="critical"
					stackId="v"
					stroke={SEVERITY_COLORS.critical}
					fill={SEVERITY_COLORS.critical}
					fillOpacity={0.55}
				/>
				<Area
					type="monotone"
					dataKey="warning"
					stackId="v"
					stroke={SEVERITY_COLORS.warning}
					fill={SEVERITY_COLORS.warning}
					fillOpacity={0.45}
				/>
				<Area
					type="monotone"
					dataKey="info"
					stackId="v"
					stroke={SEVERITY_COLORS.info}
					fill={SEVERITY_COLORS.info}
					fillOpacity={0.4}
				/>
				<Line
					type="monotone"
					dataKey="resolved"
					stroke="hsl(var(--foreground))"
					strokeWidth={1.5}
					strokeDasharray="5 3"
					dot={false}
				/>
			</ComposedChart>
		</ResponsiveContainer>
	</ChartCard>
);
