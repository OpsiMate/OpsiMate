import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AlertHistoryData } from '@OpsiMate/shared';
import { Download, History } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TimeRange } from '../../AlertsTable/TimeFilter/TimeFilter.types';
import { AlertHistoryTimeline } from '../AlertHistoryTimeline';
import { AlertHistoryQueryState } from '../hooks';
import {
	filterHistoryByLane,
	HistoryLaneFilter,
	historyToCsv,
	historyToJson,
	selectHistoryEntries,
} from '../AlertHistoryTimeline/alertHistory.utils';

interface AlertHistoryWallProps {
	history: AlertHistoryQueryState;
	// The active time-range filter (the "All time" button). History is filtered to match it.
	timeRange?: TimeRange | null;
}

interface LaneOption {
	value: HistoryLaneFilter;
	label: string;
}

// "All" draws the git-style graph (lifecycle on the main rail, user activity on the side
// rail); the other two isolate one branch as a flat timeline.
const LANE_OPTIONS: LaneOption[] = [
	{ value: 'all', label: 'All' },
	{ value: 'lifecycle', label: 'Status' },
	{ value: 'activity', label: 'Activity' },
];

// Stable empty list so the memos below don't recompute on every render while loading.
const NO_ENTRIES: AlertHistoryData[] = [];

const triggerDownload = (filename: string, mimeType: string, content: string) => {
	const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

interface HistoryContentProps {
	history: AlertHistoryQueryState;
	visible: AlertHistoryData[];
	isFiltered: boolean;
	lane: HistoryLaneFilter;
}

// What fills the tab below the header: loading first, then a failed fetch, else the
// timeline (which renders its own empty state).
const HistoryContent = ({ history, visible, isFiltered, lane }: HistoryContentProps) => {
	if (history.isLoading) {
		return (
			<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
				Loading history...
			</div>
		);
	}
	if (history.isError) {
		return (
			<div className="flex items-center justify-center py-8 text-sm text-destructive">
				Couldn't load history. Try again later.
			</div>
		);
	}
	return (
		<AlertHistoryTimeline
			data={visible}
			isFiltered={isFiltered}
			laneFilter={lane}
			// The tab's ScrollArea scrolls; the timeline must not clip itself.
			className="max-h-none overflow-visible"
		/>
	);
};

// The History tab of the details panel (sibling of CommentsWall): a header with the entry
// count, a lane filter and CSV/JSON export, over a git-style two-branch timeline. Filtered
// by the active time range so it mirrors what the "All time" button shows for the list.
export const AlertHistoryWall = ({ history, timeRange }: AlertHistoryWallProps) => {
	const historyData = history.data;
	const [lane, setLane] = useState<HistoryLaneFilter>('all');

	// Quick presets carry only `preset` (from/to stay null), so checking the dates
	// alone would treat a preset window as unfiltered.
	const isFiltered = !!(
		timeRange &&
		(timeRange.from || timeRange.to || (timeRange.preset && timeRange.preset !== 'custom'))
	);
	const entries = historyData?.data ?? NO_ENTRIES;
	const timeFiltered = useMemo(() => selectHistoryEntries(entries, timeRange), [entries, timeRange]);
	const visible = useMemo(() => filterHistoryByLane(timeFiltered, lane), [timeFiltered, lane]);

	// Export mirrors the timeline: same time window, same lane. The filename carries
	// enough to tell exports apart without opening them.
	const handleExport = (format: 'csv' | 'json') => {
		if (!historyData) return;
		const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
		// Alert ids come from external sources and can contain characters that are
		// path separators or otherwise illegal in filenames.
		const safeId = historyData.alertId.replace(/[^\w.-]+/g, '_');
		const suffix = lane === 'all' ? '' : `-${lane}`;
		if (format === 'csv') {
			triggerDownload(`alert-history-${safeId}${suffix}-${stamp}.csv`, 'text/csv', historyToCsv(visible));
		} else {
			triggerDownload(
				`alert-history-${safeId}${suffix}-${stamp}.json`,
				'application/json',
				historyToJson(visible)
			);
		}
	};

	return (
		<div className="flex flex-col h-full bg-background">
			<div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
				<History className="h-4 w-4 text-muted-foreground" />
				<h3 className="font-semibold text-sm text-foreground">History</h3>
				{visible.length > 0 && (
					<span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
						{visible.length}
					</span>
				)}
				<div className="ml-auto flex items-center gap-1.5">
					<div className="flex items-center rounded-md border border-border p-0.5">
						{LANE_OPTIONS.map((option) => (
							<button
								key={option.value}
								type="button"
								onClick={() => setLane(option.value)}
								aria-pressed={lane === option.value}
								className={cn(
									'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
									lane === option.value
										? 'bg-muted text-foreground'
										: 'text-muted-foreground hover:text-foreground'
								)}
							>
								{option.label}
							</button>
						))}
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								aria-label="Export history"
								title="Export history"
								disabled={visible.length === 0}
								className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
							>
								<Download className="h-3.5 w-3.5" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => handleExport('csv')}>Export as CSV</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleExport('json')}>Export as JSON</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-3">
					<HistoryContent history={history} visible={visible} isFiltered={isFiltered} lane={lane} />
				</div>
			</ScrollArea>
		</div>
	);
};
