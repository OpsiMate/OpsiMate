import { SeverityBadge } from '@/components/Alerts/SeverityBadge';
import { SortableTableHead, useTableSort } from '@/components/shared/SortableTable';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { formatShortDateTime } from '@/lib/datetime';
import { AlertNameStats, AlertSeverity } from '@OpsiMate/shared';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDurationMs, formatPercent } from './analytics.utils';

interface ByNameTabProps {
	rows: AlertNameStats[];
}

// Per-alert-name breakdown: which alerts dominate the window, how fast they resolve,
// and which ones flap. Reuses the shared click-to-sort header the rule tables use.
export const ByNameTab = ({ rows }: ByNameTabProps) => {
	const [search, setSearch] = useState('');
	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return rows;
		return rows.filter((row) => row.name.toLowerCase().includes(query));
	}, [rows, search]);

	const { sorted, sortKey, direction, toggle } = useTableSort(
		filtered,
		{
			name: (r: AlertNameStats) => r.name,
			episodes: (r: AlertNameStats) => r.episodes,
			mttr: (r: AlertNameStats) => r.mttrMs,
			mtbf: (r: AlertNameStats) => r.mtbfMs,
			refire: (r: AlertNameStats) => r.refireRate,
			lastSeen: (r: AlertNameStats) => new Date(r.lastSeen).getTime(),
		},
		{ initialKey: 'episodes', initialDirection: 'desc' }
	);

	return (
		<Card>
			<CardContent className="p-0">
				<div className="flex items-center gap-2 border-b p-3">
					<div className="relative max-w-xs flex-1">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="h-8 pl-9"
							placeholder="Filter by alert name"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					<span className="ml-auto text-xs text-muted-foreground">
						{filtered.length} of {rows.length}
					</span>
				</div>
				<div className="overflow-x-auto">
					<Table>
						<thead>
							<TableRow>
								<SortableTableHead
									sortKey="name"
									activeKey={sortKey}
									direction={direction}
									onToggle={toggle}
								>
									Alert name
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
									sortKey="mtbf"
									activeKey={sortKey}
									direction={direction}
									onToggle={toggle}
								>
									MTBF
								</SortableTableHead>
								<SortableTableHead
									sortKey="refire"
									activeKey={sortKey}
									direction={direction}
									onToggle={toggle}
								>
									Re-fire
								</SortableTableHead>
								<SortableTableHead
									sortKey="lastSeen"
									activeKey={sortKey}
									direction={direction}
									onToggle={toggle}
								>
									Last seen
								</SortableTableHead>
							</TableRow>
						</thead>
						<TableBody>
							{sorted.map((row) => (
								<TableRow key={row.name}>
									<TableCell className="max-w-[280px]">
										<div className="flex items-center gap-2">
											<span className="truncate font-medium" title={row.name}>
												{row.name}
											</span>
											{row.worstSeverity && (
												<SeverityBadge severity={row.worstSeverity as AlertSeverity} />
											)}
											{row.firingNow > 0 && (
												<Badge variant="destructive" className="h-4 px-1 text-[10px]">
													firing
												</Badge>
											)}
										</div>
									</TableCell>
									<TableCell className="tabular-nums">{row.episodes}</TableCell>
									<TableCell className="tabular-nums">{formatDurationMs(row.mttrMs)}</TableCell>
									<TableCell className="tabular-nums">{formatDurationMs(row.mtbfMs)}</TableCell>
									<TableCell className="tabular-nums">{formatPercent(row.refireRate)}</TableCell>
									<TableCell className="whitespace-nowrap text-muted-foreground">
										{formatShortDateTime(row.lastSeen, row.lastSeen)}
									</TableCell>
								</TableRow>
							))}
							{sorted.length === 0 && (
								<TableRow>
									<TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
										No alerts in this window
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
};
