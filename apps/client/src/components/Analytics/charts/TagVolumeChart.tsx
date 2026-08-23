import { BucketGranularity, TagValueDayPoint } from '@OpsiMate/shared';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBucketTick } from '../analytics.utils';
import { axisTick, ChartCard, tooltipStyle } from './chartTheme';

interface TagVolumeChartProps {
	// Series order (top values by episode count); colors assign by position.
	topValues: string[];
	data: TagValueDayPoint[];
	tagKey: string;
	granularity: BucketGranularity;
}

// A stable qualitative palette for dynamic series (tag values aren't severities, so
// the severity colors would lie here).
export const SERIES_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

interface FlatPoint {
	date: string;
	[value: string]: string | number;
}

// Series keys are namespaced so a tag value can never collide with the x-axis
// field — a value literally named "date" must not clobber it.
const seriesKey = (value: string): string => `v:${value}`;

// Daily volume stacked by tag VALUE for the researched key — which value of
// `service` (say) is generating the load, and when.
export const TagVolumeChart = ({ topValues, data, tagKey, granularity }: TagVolumeChartProps) => {
	const flat: FlatPoint[] = data.map((point) => {
		const row: FlatPoint = { date: point.date };
		for (const [value, count] of Object.entries(point.counts)) row[seriesKey(value)] = count;
		return row;
	});
	return (
		<ChartCard
			title={`Volume by ${tagKey}`}
			hint={`Firing episodes per day, split across the top ${topValues.length} values`}
		>
			<ResponsiveContainer width="100%" height={240}>
				<AreaChart data={flat} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
					<XAxis
						dataKey="date"
						tick={axisTick}
						tickLine={false}
						axisLine={false}
						minTickGap={24}
						tickFormatter={(v: string) => formatBucketTick(v, granularity)}
					/>
					<YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
					<Tooltip contentStyle={tooltipStyle} />
					{topValues.map((value, index) => (
						<Area
							key={value}
							type="monotone"
							name={value}
							dataKey={seriesKey(value)}
							stackId="t"
							stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
							fill={SERIES_COLORS[index % SERIES_COLORS.length]}
							fillOpacity={0.45}
						/>
					))}
				</AreaChart>
			</ResponsiveContainer>
			<div className="mt-1 flex flex-wrap justify-center gap-3">
				{topValues.map((value, index) => (
					<span key={value} className="flex items-center gap-1 text-[11px] text-muted-foreground">
						<span
							className="h-2 w-2 rounded-full"
							style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }}
						/>
						{value}
					</span>
				))}
			</div>
		</ChartCard>
	);
};
