import { SeveritySlice } from '@OpsiMate/shared';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { SEVERITY_COLORS } from '../analytics.utils';
import { ChartCard, tooltipStyle } from './chartTheme';

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
