import { cn } from '@/lib/utils';
import { DurationDayPoint } from '@OpsiMate/shared';
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDurationMs } from '../analytics.utils';
import { axisTick, ChartCard, tooltipStyle } from './chartTheme';

// One line on the trend chart (e.g. a tag value, or the single headline series).
export interface TrendSeries {
	name: string;
	// Defaults to the theme primary — pass explicit colors for multi-line charts.
	color?: string;
	data: DurationDayPoint[];
}

// One switchable duration metric (MTTR, MTTA, ...) with its line(s).
export interface TrendMetric {
	key: string;
	label: string;
	hint: string;
	series: TrendSeries[];
}

interface DurationTrendChartProps {
	title: string;
	metrics: TrendMetric[];
}

interface FlatRow {
	date: string;
	[seriesKey: string]: string | number | null;
}

// Series keys are namespaced so a series name can never collide with the x-axis
// field — a tag value literally named "date" must not clobber it.
const seriesKey = (name: string): string => `s:${name}`;

// Mean duration per day, switchable between metrics (MTTR ⇄ MTTA) and split into
// one line per series. Days without samples carry a null mean and BREAK the line:
// bridging them would draw a made-up slope through days where nothing was measured.
export const DurationTrendChart = ({ title, metrics }: DurationTrendChartProps) => {
	const [selectedKey, setSelectedKey] = useState(metrics[0]?.key);
	const active = metrics.find((metric) => metric.key === selectedKey) ?? metrics[0];
	if (!active) return null;

	const dates = [...new Set(active.series.flatMap((series) => series.data.map((point) => point.date)))].sort();
	const rowsByDate = new Map<string, FlatRow>(dates.map((date) => [date, { date }]));
	for (const series of active.series) {
		for (const point of series.data) {
			const row = rowsByDate.get(point.date);
			if (row) row[seriesKey(series.name)] = point.meanMs;
		}
	}
	const rows = [...rowsByDate.values()];

	return (
		<ChartCard
			title={title}
			hint={active.hint}
			actions={
				metrics.length > 1 && (
					<div className="flex gap-1" role="tablist" aria-label="Trend metric">
						{metrics.map((metric) => (
							<button
								key={metric.key}
								role="tab"
								aria-selected={metric.key === active.key}
								onClick={() => setSelectedKey(metric.key)}
								className={cn(
									'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
									metric.key === active.key
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground hover:text-foreground'
								)}
							>
								{metric.label}
							</button>
						))}
					</div>
				)
			}
		>
			<ResponsiveContainer width="100%" height={220}>
				<LineChart data={rows} margin={{ top: 4, right: 8, left: 2, bottom: 0 }}>
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
						formatter={(value, name) => [formatDurationMs(value as number), String(name)]}
					/>
					{active.series.map((series) => {
						const color = series.color ?? 'hsl(var(--primary))';
						return (
							<Line
								key={series.name}
								name={series.name}
								dataKey={seriesKey(series.name)}
								type="monotone"
								stroke={color}
								strokeWidth={2}
								dot={{ r: 2.5, strokeWidth: 0, fill: color }}
							/>
						);
					})}
				</LineChart>
			</ResponsiveContainer>
			{active.series.length > 1 && (
				<div className="mt-1 flex flex-wrap justify-center gap-3">
					{active.series.map((series) => (
						<span key={series.name} className="flex items-center gap-1 text-[11px] text-muted-foreground">
							<span
								className="h-2 w-2 rounded-full"
								style={{ backgroundColor: series.color ?? 'hsl(var(--primary))' }}
							/>
							{series.name}
						</span>
					))}
				</div>
			)}
		</ChartCard>
	);
};
