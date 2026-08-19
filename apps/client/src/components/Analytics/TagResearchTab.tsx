import { SeverityBadge } from '@/components/Alerts/SeverityBadge';
import { SortableTableHead, useTableSort } from '@/components/shared/SortableTable';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { AlertSeverity, TagInsights, TagValueStats } from '@OpsiMate/shared';
import { Tag as TagIcon } from 'lucide-react';
import { formatDurationMs, formatPercent } from './analytics.utils';
import { TagVolumeChart } from './charts/TagVolumeChart';
import { KpiCard } from './KpiCard';
import { DurationTrendChart, TopList } from './charts';

interface TagResearchTabProps {
	availableTagKeys: string[];
	selectedKey: string | null;
	onSelectKey: (key: string) => void;
	// Present once a key is selected and the (refetched) payload carries it.
	insights?: TagInsights;
	isFetching: boolean;
}

// keepPreviousData holds the PREVIOUS payload while a new key loads — render only
// insights that actually belong to the selected key, never another key's numbers.
const insightsForKey = (insights: TagInsights | undefined, selectedKey: string | null): TagInsights | undefined =>
	insights && insights.key === selectedKey ? insights : undefined;

// Research one tag key: pick "service" and see which values generate the load, how
// fast each resolves, and what's burning right now — the tag-level view of the same
// window/scope the rest of the page uses.
export const TagResearchTab = ({
	availableTagKeys,
	selectedKey,
	onSelectKey,
	insights: rawInsights,
	isFetching,
}: TagResearchTabProps) => {
	const insights = insightsForKey(rawInsights, selectedKey);
	const rows = insights?.values ?? [];
	const { sorted, sortKey, direction, toggle } = useTableSort(
		rows,
		{
			value: (r: TagValueStats) => r.value,
			episodes: (r: TagValueStats) => r.episodes,
			resolved: (r: TagValueStats) => r.resolvedCount,
			mttr: (r: TagValueStats) => r.mttrMs,
			firing: (r: TagValueStats) => r.firingNow,
		},
		{ initialKey: 'episodes', initialDirection: 'desc' }
	);

	const coverage =
		insights && insights.taggedEpisodes + insights.untaggedEpisodes > 0
			? insights.taggedEpisodes / (insights.taggedEpisodes + insights.untaggedEpisodes)
			: null;

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<Select value={selectedKey ?? undefined} onValueChange={onSelectKey}>
					<SelectTrigger className="h-9 w-[240px]" aria-label="Tag key to research">
						<TagIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						<SelectValue placeholder="Pick a tag key…" />
					</SelectTrigger>
					<SelectContent>
						{availableTagKeys.map((key) => (
							<SelectItem key={key} value={key}>
								{key}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{isFetching && <span className="text-xs text-muted-foreground">Crunching…</span>}
			</div>

			{!selectedKey && (
				<div className="py-16 text-center text-sm text-muted-foreground">
					Pick a tag key to break the window down by its values — episodes, restore times and what's firing,
					per value.
				</div>
			)}

			{selectedKey && insights && (
				<>
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<KpiCard
							label="Distinct values"
							value={String(insights.values.length)}
							hint={`of tag "${insights.key}"`}
						/>
						<KpiCard
							label="Tagged episodes"
							value={String(insights.taggedEpisodes)}
							hint={`${insights.untaggedEpisodes} without this tag`}
						/>
						<KpiCard
							label="Tag coverage"
							value={formatPercent(coverage)}
							hint="Share of episodes carrying this key"
						/>
						<KpiCard
							label="Firing now"
							value={String(rows.reduce((sum, r) => sum + r.firingNow, 0))}
							hint="Across all values of this key"
						/>
					</div>

					<div className="grid gap-4 lg:grid-cols-2">
						{insights.volumeByDay.length > 0 && (
							<TagVolumeChart
								topValues={insights.topValues}
								data={insights.volumeByDay}
								tagKey={insights.key}
							/>
						)}
						<DurationTrendChart
							title={`Response trend — ${insights.key}`}
							metrics={[
								{
									key: 'mttr',
									label: 'MTTR',
									hint: `Mean time to restore per day, over episodes tagged with "${insights.key}"`,
									data: insights.mttrByDay,
								},
								{
									key: 'mtta',
									label: 'MTTA',
									hint: `Mean time to first human touch per day, over episodes tagged with "${insights.key}"`,
									data: insights.mttaByDay,
								},
							]}
						/>
					</div>

					<div className="grid gap-4 lg:grid-cols-2">
						<TopList
							title={`Episodes by ${insights.key}`}
							hint="Which values generate the load"
							items={insights.values.map((v) => ({ name: v.value, count: v.episodes }))}
						/>
						<Card>
							<CardContent className="p-0">
								<div className="overflow-x-auto">
									<Table>
										<thead>
											<TableRow>
												<SortableTableHead
													sortKey="value"
													activeKey={sortKey}
													direction={direction}
													onToggle={toggle}
												>
													Value
												</SortableTableHead>
												<SortableTableHead
													sortKey="episodes"
													activeKey={sortKey}
													direction={direction}
													onToggle={toggle}
												>
													Episodes
												</SortableTableHead>
												<SortableTableHead
													sortKey="mttr"
													activeKey={sortKey}
													direction={direction}
													onToggle={toggle}
												>
													MTTR
												</SortableTableHead>
												<SortableTableHead
													sortKey="firing"
													activeKey={sortKey}
													direction={direction}
													onToggle={toggle}
												>
													Firing
												</SortableTableHead>
											</TableRow>
										</thead>
										<TableBody>
											{sorted.map((row) => (
												<TableRow key={row.value}>
													<TableCell className="max-w-[200px]">
														<div className="flex items-center gap-2">
															<span className="truncate font-medium" title={row.value}>
																{row.value}
															</span>
															{row.worstSeverity && (
																<SeverityBadge
																	severity={row.worstSeverity as AlertSeverity}
																/>
															)}
														</div>
													</TableCell>
													<TableCell className="tabular-nums">{row.episodes}</TableCell>
													<TableCell className="tabular-nums">
														{formatDurationMs(row.mttrMs)}
													</TableCell>
													<TableCell>
														{row.firingNow > 0 ? (
															<Badge
																variant="destructive"
																className="h-4 px-1 text-[10px]"
															>
																{row.firingNow}
															</Badge>
														) : (
															<span className="text-muted-foreground">—</span>
														)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							</CardContent>
						</Card>
					</div>
				</>
			)}
		</div>
	);
};
