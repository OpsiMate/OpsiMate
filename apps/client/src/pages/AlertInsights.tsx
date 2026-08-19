import { ByNameTab } from '@/components/Analytics/ByNameTab';
import { HourBarChart, SeverityDonut, TopList, VolumeAreaChart } from '@/components/Analytics/charts';
import { KpiCard } from '@/components/Analytics/KpiCard';
import { ReliabilityTab } from '@/components/Analytics/ReliabilityTab';
import { formatPercent, TIME_PRESETS } from '@/components/Analytics/analytics.utils';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useAlertAnalytics } from '@/hooks/queries/useAlertAnalytics';
import { BarChart3, BellOff, CheckCircle2, Flame, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

// The Insights page: aggregate analytics over the alert history, scoped by a time
// window and split into three views — Overview (volume and distributions),
// Reliability (DORA-style restore metrics), and By alert (per-name breakdown).
// All numbers come pre-aggregated from one endpoint; the page renders the same
// whether the installation has a hundred alerts or a million.
const AlertInsights = () => {
	const [preset, setPreset] = useState('7d');
	const from = useMemo(() => {
		const hours = TIME_PRESETS.find((p) => p.key === preset)?.hours ?? null;
		return hours === null ? null : new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
		// Recompute when the preset changes; "now" drift between clicks is irrelevant
		// at these window sizes.
	}, [preset]);

	const { data, isLoading, isError } = useAlertAnalytics(from);

	return (
		<DashboardLayout>
			<div className="container mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<div className="flex items-center gap-2">
							<BarChart3 className="h-6 w-6 text-muted-foreground" />
							<h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							How your alerts behave over time — volume, peak hours, restore times and the alerts that
							keep coming back.
						</p>
					</div>
					<div className="flex items-center rounded-lg border border-border p-0.5">
						{TIME_PRESETS.map((option) => (
							<button
								key={option.key}
								type="button"
								onClick={() => setPreset(option.key)}
								aria-pressed={preset === option.key}
								className={cn(
									'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
									preset === option.key
										? 'bg-primary text-primary-foreground'
										: 'text-muted-foreground hover:text-foreground'
								)}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>

				{isLoading && (
					<div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" /> Crunching the history…
					</div>
				)}
				{isError && <div className="py-24 text-center text-sm text-destructive">Failed to load analytics</div>}

				{data && (
					<Tabs defaultValue="overview">
						<TabsList>
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="reliability">Reliability</TabsTrigger>
							<TabsTrigger value="byName">By alert</TabsTrigger>
						</TabsList>

						<TabsContent value="overview" className="mt-4 space-y-4">
							<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
								<KpiCard
									label="Alert episodes"
									value={String(data.overview.totalEpisodes.value)}
									rawValue={data.overview.totalEpisodes.value}
									rawPrevious={data.overview.totalEpisodes.previous}
									upIsGood={false}
									hint="Firing episodes started in the window"
									icon={<Flame className="h-3.5 w-3.5" />}
								/>
								<KpiCard
									label="Resolved"
									value={String(data.overview.resolvedInRange.value)}
									rawValue={data.overview.resolvedInRange.value}
									rawPrevious={data.overview.resolvedInRange.previous}
									upIsGood={true}
									hint="Resolutions in the window"
									icon={<CheckCircle2 className="h-3.5 w-3.5" />}
								/>
								<KpiCard
									label="Firing now"
									value={String(data.overview.firingNow)}
									hint={`${data.overview.silencedNow} silenced or muted`}
									icon={<Flame className="h-3.5 w-3.5" />}
								/>
								<KpiCard
									label="Noise ratio"
									value={formatPercent(data.overview.noiseRatio)}
									hint="Active alerts currently suppressed"
									icon={<BellOff className="h-3.5 w-3.5" />}
								/>
							</div>
							<VolumeAreaChart data={data.overview.volumeByDay} />
							<div className="grid gap-4 lg:grid-cols-2">
								<HourBarChart data={data.overview.volumeByHour} />
								<SeverityDonut data={data.overview.severity} />
							</div>
							<div className="grid gap-4 lg:grid-cols-2">
								<TopList
									title="Top alerts"
									hint="Most frequent alert names in the window"
									items={data.overview.topAlertNames}
								/>
								<TopList
									title="Common tags"
									hint="Most frequent tag values across alerting alerts"
									items={data.overview.topTags}
								/>
							</div>
						</TabsContent>

						<TabsContent value="reliability" className="mt-4">
							<ReliabilityTab reliability={data.reliability} />
						</TabsContent>

						<TabsContent value="byName" className="mt-4">
							<ByNameTab rows={data.byName} />
						</TabsContent>
					</Tabs>
				)}
			</div>
		</DashboardLayout>
	);
};

export default AlertInsights;
