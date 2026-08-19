import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { AlertHistory } from '@OpsiMate/shared';
import { Download, History } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TimeRange } from '../../AlertsTable/TimeFilter/TimeFilter.types';
import { AlertHistoryTimeline } from '../AlertHistoryTimeline';
import {
	filterHistoryByLane,
	HistoryLaneFilter,
	historyToCsv,
	historyToJson,
	selectHistoryEntries,
} from '../AlertHistoryTimeline/alertHistory.utils';
import { CollapsibleSection } from '../CollapsibleSection';

interface AlertHistorySectionProps {
	historyData: AlertHistory;
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

const triggerDownload = (filename: string, mimeType: string, content: string) => {
	const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

// Self-contained collapsible History section: a git-style two-branch timeline with a
// lane filter and CSV/JSON export, filtered by the active time range so it mirrors what
// the "All time" button shows for the alerts list.
export const AlertHistorySection = ({ historyData, timeRange }: AlertHistorySectionProps) => {
	const [lane, setLane] = useState<HistoryLaneFilter>('all');

	// Quick presets carry only `preset` (from/to stay null), so checking the dates
	// alone would treat a preset window as unfiltered.
	const isFiltered = !!(
		timeRange &&
		(timeRange.from || timeRange.to || (timeRange.preset && timeRange.preset !== 'custom'))
	);
	const timeFiltered = useMemo(
		() => selectHistoryEntries(historyData.data, timeRange),
		[historyData.data, timeRange]
	);
	const visible = useMemo(() => filterHistoryByLane(timeFiltered, lane), [timeFiltered, lane]);

	if (!historyData.data.length) {
		return null;
	}

	// Export mirrors the timeline: same time window, same lane. The filename carries
	// enough to tell exports apart without opening them.
	const handleExport = (format: 'csv' | 'json') => {
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
		<CollapsibleSection
			title="History"
			icon={<History className="h-3.5 w-3.5" />}
			badge={visible.length}
			defaultOpen={false}
			headerRight={
				<div className="flex items-center gap-1.5">
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
								className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
			}
		>
			<AlertHistoryTimeline data={visible} isFiltered={isFiltered} laneFilter={lane} />
		</CollapsibleSection>
	);
};
