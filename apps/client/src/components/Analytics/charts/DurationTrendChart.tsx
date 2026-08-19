import { cn } from '@/lib/utils';
import { DurationDayPoint } from '@OpsiMate/shared';
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDurationMs } from '../analytics.utils';
import { axisTick, ChartCard, tooltipStyle } from './chartTheme';

// One switchable duration series (MTTR, MTTA, ...) for the trend chart.
export interface TrendMetric {
	key: string;
	label: string;
	hint: string;
	data: DurationDayPoint[];
}

interface DurationTrendChartProps {
	title: string;
	metrics: TrendMetric[];
}

// Mean duration per day, switchable between metrics (MTTR ⇄ MTTA). Days without
// samples carry a null mean and BREAK the line: bridging them would draw a made-up
// slope through days where nothing was measured.
export const DurationTrendChart = ({ title, metrics }: DurationTrendChartProps) => {
	const [selectedKey, setSelectedKey] = useState(metrics[0]?.key);
	const active = metrics.find((metric) => metric.key === selectedKey) ?? metrics[0];
	if (!active) return null;
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
				<LineChart data={active.data} margin={{ top: 4, right: 8, left: 2, bottom: 0 }}>
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
						formatter={(value) => [formatDurationMs(value as number), active.label]}
					/>
					<Line
						type="monotone"
						dataKey="meanMs"
						stroke="hsl(var(--primary))"
						strokeWidth={2}
						dot={{ r: 2.5, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
					/>
				</LineChart>
			</ResponsiveContainer>
		</ChartCard>
	);
};
