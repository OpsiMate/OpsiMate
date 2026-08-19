import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsReliability } from '@OpsiMate/shared';
import { Activity, CheckCheck, Flame, Gauge, RotateCcw, Timer } from 'lucide-react';
import { DurationTrendChart } from './charts';
import { formatDurationMs, formatPercent } from './analytics.utils';
import { KpiCard } from './KpiCard';

interface ReliabilityTabProps {
	reliability: AnalyticsReliability;
}

// DORA's "time to restore service" plus the alert-world adaptations of its siblings.
// Every card says what it measures in plain words — these numbers get quoted in
// reviews, so their definitions must travel with them.
export const ReliabilityTab = ({ reliability }: ReliabilityTabProps) => {
	const { mttr, mtta, mtbf, refireRate, ackCoverage, episodesPerDay } = reliability;
	return (
		<div className="space-y-4">
			<DurationTrendChart
				title="Response trend"
				metrics={[
					{
						key: 'mttr',
						label: 'MTTR',
						hint: "Mean time to restore per day, over that day's resolutions",
						data: reliability.mttrByDay,
					},
					{
						key: 'mtta',
						label: 'MTTA',
						hint: "Mean time to first human touch per day, over that day's acknowledgements",
						data: reliability.mttaByDay,
					},
				]}
			/>
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
				<KpiCard
					label="MTTR (mean)"
					value={formatDurationMs(mttr.meanMs)}
					rawValue={mttr.meanMs}
					rawPrevious={mttr.previousMeanMs}
					upIsGood={false}
					hint={`Time to restore, ${mttr.count} resolutions`}
					icon={<Timer className="h-3.5 w-3.5" />}
				/>
				<KpiCard
					label="MTTA"
					value={formatDurationMs(mtta.meanMs)}
					hint={`First human touch, ${mtta.count} episodes`}
					icon={<Gauge className="h-3.5 w-3.5" />}
				/>
				<KpiCard
					label="MTBF"
					value={formatDurationMs(mtbf.meanMs)}
					hint={`Between firings, ${mtbf.alertsMeasured} alerts measured`}
					icon={<Activity className="h-3.5 w-3.5" />}
				/>
				<KpiCard
					label="Re-fire rate"
					value={formatPercent(refireRate.rate)}
					hint={`${refireRate.refired} of ${refireRate.resolutions} resolutions re-fired <24h`}
					icon={<RotateCcw className="h-3.5 w-3.5" />}
				/>
				<KpiCard
					label="Ack coverage"
					value={formatPercent(ackCoverage.rate)}
					hint={`${ackCoverage.acked} of ${ackCoverage.episodes} episodes touched by a human`}
					icon={<CheckCheck className="h-3.5 w-3.5" />}
				/>
				<KpiCard
					label="Episodes / day"
					value={String(episodesPerDay.value)}
					rawValue={episodesPerDay.value}
					rawPrevious={episodesPerDay.previous}
					upIsGood={false}
					hint="Firing frequency over the window"
					icon={<Flame className="h-3.5 w-3.5" />}
				/>
			</div>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-semibold">Percentiles</CardTitle>
					<p className="text-[11px] text-muted-foreground">
						Means lie under skew — one week-long outage doubles them. Medians tell the typical story, p90
						the bad days.
					</p>
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-x-8 gap-y-2 pt-0 text-sm sm:grid-cols-3">
					<div>
						<div className="text-xs text-muted-foreground">MTTR median</div>
						<div className="font-semibold">{formatDurationMs(mttr.medianMs)}</div>
					</div>
					<div>
						<div className="text-xs text-muted-foreground">MTTR p90</div>
						<div className="font-semibold">{formatDurationMs(mttr.p90Ms)}</div>
					</div>
					<div>
						<div className="text-xs text-muted-foreground">MTTA median</div>
						<div className="font-semibold">{formatDurationMs(mtta.medianMs)}</div>
					</div>
					<div>
						<div className="text-xs text-muted-foreground">MTTA p90</div>
						<div className="font-semibold">{formatDurationMs(mtta.p90Ms)}</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-semibold">How these are measured</CardTitle>
				</CardHeader>
				<CardContent className="space-y-1.5 pt-0 text-xs text-muted-foreground">
					<p>
						<span className="font-medium text-foreground">MTTR</span> — DORA's "time to restore service":
						firing → resolved, per episode resolved in the window.
					</p>
					<p>
						<span className="font-medium text-foreground">MTTA</span> — firing → first human action (own,
						silence, comment, action, resolve) on that alert.
					</p>
					<p>
						<span className="font-medium text-foreground">Re-fire rate</span> — the change-failure-rate
						analog: resolutions where the same alert fired again within 24 hours. High values mean fixes
						don't hold (or the alert flaps).
					</p>
					<p>
						<span className="font-medium text-foreground">MTBF</span> — mean gap between consecutive firings
						of the same alert; low values point at flapping monitors.
					</p>
				</CardContent>
			</Card>
		</div>
	);
};
