import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	DayVolumePoint,
	HourVolumePoint,
	MttrDayPoint,
	NamedCount,
	SeveritySlice,
	WeekdayVolumePoint,
} from '@OpsiMate/shared';
import { ReactNode } from 'react';
import {
	Area,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ComposedChart,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { formatDurationMs, SEVERITY_COLORS } from './analytics.utils';

// Shared recharts dressing: the tooltip reads from CSS variables so it follows the
// theme; axes stay muted so the data carries the contrast.
const tooltipStyle = {
	backgroundColor: 'hsl(var(--popover))',
	border: '1px solid hsl(var(--border))',
	borderRadius: '8px',
	color: 'hsl(var(--popover-foreground))',
	fontSize: '12px',
};
const axisTick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

const ChartCard = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
	<Card>
		<CardHeader className="pb-2">
			<CardTitle className="text-sm font-semibold">{title}</CardTitle>
			{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
		</CardHeader>
		<CardContent className="pt-0">{children}</CardContent>
	</Card>
);

// Alert volume per day, stacked by severity, with the day's resolutions overlaid as a
// dashed line — the "are we keeping up" read at a glance.
export const VolumeAreaChart = ({ data }: { data: DayVolumePoint[] }) => (
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

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Day-of-week histogram — "is Monday really the worst".
export const WeekdayBarChart = ({ data }: { data: WeekdayVolumePoint[] }) => {
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

// Hour-of-day histogram: "when do alerts hit us", in the viewer's timezone.
export const HourBarChart = ({ data }: { data: HourVolumePoint[] }) => {
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

export const SeverityDonut = ({ data }: { data: SeveritySlice[] }) => {
	const total = data.reduce((sum, s) => sum + s.count, 0);
	return (
		<ChartCard title="Severity split" hint="Episodes in the window by severity">
			<div className="relative">
				<ResponsiveContainer width="100%" height={200}>
					<PieChart>
						<Tooltip contentStyle={tooltipStyle} />
						<Pie
							data={data}
							dataKey="count"
							nameKey="severity"
							innerRadius={58}
							outerRadius={82}
							paddingAngle={2}
							strokeWidth={0}
						>
							{data.map((slice) => (
								<Cell key={slice.severity} fill={SEVERITY_COLORS[slice.severity] ?? '#64748b'} />
							))}
						</Pie>
					</PieChart>
				</ResponsiveContainer>
				<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
					<span className="text-xl font-bold text-foreground">{total}</span>
					<span className="text-[11px] text-muted-foreground">episodes</span>
				</div>
			</div>
			<div className="mt-1 flex justify-center gap-3">
				{data.map((slice) => (
					<span key={slice.severity} className="flex items-center gap-1 text-[11px] text-muted-foreground">
						<span
							className="h-2 w-2 rounded-full"
							style={{ backgroundColor: SEVERITY_COLORS[slice.severity] ?? '#64748b' }}
						/>
						{slice.severity} · {slice.count}
					</span>
				))}
			</div>
		</ChartCard>
	);
};

// Ranked list with proportional bars — reads faster than a rotated bar chart for
// name-length labels, and needs no chart plumbing.
export const TopList = ({ title, hint, items }: { title: string; hint?: string; items: NamedCount[] }) => {
	const max = Math.max(...items.map((i) => i.count), 1);
	return (
		<ChartCard title={title} hint={hint}>
			{items.length === 0 ? (
				<p className="py-6 text-center text-sm text-muted-foreground">Nothing in this window</p>
			) : (
				<div className="space-y-1.5">
					{items.map((item) => (
						<div key={item.name} className="relative flex items-center gap-2 rounded-md px-2 py-1">
							<div
								className="absolute inset-y-0 left-0 rounded-md bg-primary/10"
								style={{ width: `${(item.count / max) * 100}%` }}
							/>
							<span className="relative z-10 flex-1 truncate text-xs text-foreground" title={item.name}>
								{item.name}
							</span>
							<span className="relative z-10 text-xs font-semibold tabular-nums text-foreground">
								{item.count}
							</span>
						</div>
					))}
				</div>
			)}
		</ChartCard>
	);
};
