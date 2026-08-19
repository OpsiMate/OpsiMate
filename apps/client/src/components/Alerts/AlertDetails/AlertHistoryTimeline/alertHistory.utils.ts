import { AlertHistoryData, AlertHistoryEventType } from '@OpsiMate/shared';
import { TimeRange } from '../../AlertsTable/TimeFilter/TimeFilter.types';
import { resolveTimeRange } from '../../AlertsTable/TimeFilter/TimeFilter.utils';

// Filters history entries to the active time range. An empty range ("All time") returns
// everything. Mirrors how the alerts list itself is filtered by the time button —
// including quick presets, which resolve to a fresh window at call time.
export const filterHistoryByRange = (data: AlertHistoryData[], timeRange?: TimeRange | null): AlertHistoryData[] => {
	if (!timeRange) {
		return data;
	}
	const resolved = resolveTimeRange(timeRange);
	if (!resolved.from && !resolved.to) {
		return data;
	}
	const fromMs = resolved.from ? resolved.from.getTime() : null;
	const toMs = resolved.to ? resolved.to.getTime() : null;
	return data.filter((item) => {
		const t = new Date(item.date).getTime();
		if (fromMs !== null && t < fromMs) return false;
		if (toMs !== null && t > toMs) return false;
		return true;
	});
};

// Entries the timeline should show for the active window. Real events (transitions,
// silences, comments…) always win; the synthesized last-update entry is a FALLBACK: it
// steps in only when the window hides every real event — the case where the alert is
// listed because of a recent update but all its history predates the window. On "All
// time" (or any window containing real events) it stays out of the log entirely.
export const selectHistoryEntries = (data: AlertHistoryData[], timeRange?: TimeRange | null): AlertHistoryData[] => {
	const realEntries = data.filter((entry) => entry.eventType !== AlertHistoryEventType.UPDATED);
	const filteredReal = filterHistoryByRange(realEntries, timeRange);
	if (filteredReal.length > 0 || realEntries.length === data.length) {
		return filteredReal;
	}
	const updatedEntries = data.filter((entry) => entry.eventType === AlertHistoryEventType.UPDATED);
	return filterHistoryByRange(updatedEntries, timeRange);
};

// ---------------------------------------------------------------------------
// Git-style history graph + export
// ---------------------------------------------------------------------------

// Which branch of the git-style graph an entry belongs to. Lifecycle events (firing /
// resolved / unresolved — automatic or manual) are the MAIN branch: they tell the story
// of the alert itself. Everything a user did around it (comments, silences, ownership,
// actions, source updates) is the SIDE branch.
export type HistoryLane = 'lifecycle' | 'activity';

// Which entries the timeline shows: the full graph or a single branch.
export type HistoryLaneFilter = 'all' | HistoryLane;

const LIFECYCLE_EVENTS: ReadonlySet<AlertHistoryEventType> = new Set([
	AlertHistoryEventType.STATUS_CHANGED,
	AlertHistoryEventType.RESOLVED,
	AlertHistoryEventType.UNRESOLVED,
]);

export const historyEntryLane = (entry: AlertHistoryData): HistoryLane =>
	LIFECYCLE_EVENTS.has(entry.eventType ?? AlertHistoryEventType.STATUS_CHANGED) ? 'lifecycle' : 'activity';

export const filterHistoryByLane = (data: AlertHistoryData[], lane: HistoryLaneFilter): AlertHistoryData[] =>
	lane === 'all' ? data : data.filter((entry) => historyEntryLane(entry) === lane);

// One rendered row of the graph. Side-branch runs (consecutive activity entries between
// two lifecycle events) carry boundary flags so the timeline can draw the git-style
// corner connectors: the newest entry of a run curves out of the main rail, the oldest
// curves back into it, and the entries between share a straight side rail.
export interface HistoryGraphRow {
	entry: AlertHistoryData;
	lane: HistoryLane;
	sideRunStart: boolean;
	sideRunEnd: boolean;
}

// data is newest-first, as the timeline renders it.
export const buildHistoryGraph = (data: AlertHistoryData[]): HistoryGraphRow[] =>
	data.map((entry, i) => {
		const lane = historyEntryLane(entry);
		if (lane === 'lifecycle') {
			return { entry, lane, sideRunStart: false, sideRunEnd: false };
		}
		const prevIsSide = i > 0 && historyEntryLane(data[i - 1]) === 'activity';
		const nextIsSide = i < data.length - 1 && historyEntryLane(data[i + 1]) === 'activity';
		return { entry, lane, sideRunStart: !prevIsSide, sideRunEnd: !nextIsSide };
	});

// ---------------------------------------------------------------------------
// Export. Serializers are pure so they can be tested byte-for-byte; the download
// plumbing lives in the component.
// ---------------------------------------------------------------------------

const EXPORT_LABELS: Record<string, string> = {
	[AlertHistoryEventType.STATUS_CHANGED]: 'Status changed',
	[AlertHistoryEventType.OWNER_ASSIGNED]: 'Owner assigned',
	[AlertHistoryEventType.OWNER_UNASSIGNED]: 'Owner removed',
	[AlertHistoryEventType.SILENCED]: 'Silenced',
	[AlertHistoryEventType.UNSILENCED]: 'Unsilenced',
	[AlertHistoryEventType.RESOLVED]: 'Resolved',
	[AlertHistoryEventType.UNRESOLVED]: 'Unresolved',
	[AlertHistoryEventType.ACTION_RUN]: 'Action run',
	[AlertHistoryEventType.COMMENT_ADDED]: 'Comment added',
	[AlertHistoryEventType.UPDATED]: 'Updated',
	[AlertHistoryEventType.INCIDENT_ADDED]: 'Grouped into incident',
	[AlertHistoryEventType.INCIDENT_REMOVED]: 'Removed from incident',
};

const exportEventLabel = (entry: AlertHistoryData): string => {
	const eventType = entry.eventType ?? AlertHistoryEventType.STATUS_CHANGED;
	if (eventType === AlertHistoryEventType.STATUS_CHANGED) {
		return entry.status === 'firing' ? 'Firing' : 'Resolved';
	}
	return EXPORT_LABELS[eventType] ?? String(eventType);
};

// Spreadsheets execute cells that begin with a formula trigger even when the field is
// properly quoted — and actor names and descriptions carry user-typed text, so a user
// named "=HYPERLINK(...)" would become a live formula in an exported file. The standard
// neutralization is a leading apostrophe, which spreadsheets read as "literal text".
// Applied to EVERY field (not just actorName): benign fields never start with a trigger,
// so the guard is invisible where it isn't needed.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const neutralizeFormula = (value: string): string => (FORMULA_TRIGGER.test(value) ? `'${value}` : value);

// RFC 4180: quote every field, double any quotes inside, and normalize embedded line
// breaks to CRLF so a multi-line description stays one record for strict parsers.
const csvField = (value: string): string =>
	`"${neutralizeFormula(value)
		.replace(/\r\n|\r|\n/g, '\r\n')
		.replace(/"/g, '""')}"`;

export const historyToCsv = (data: AlertHistoryData[]): string => {
	const header = ['date', 'event', 'branch', 'status', 'actor', 'description'];
	const rows = data.map((entry) =>
		[
			entry.date,
			exportEventLabel(entry),
			historyEntryLane(entry),
			entry.status ?? '',
			entry.actorName ?? '',
			entry.description ?? '',
		]
			.map(csvField)
			.join(',')
	);
	// CRLF record separator per RFC 4180 (embedded breaks are normalized to CRLF too,
	// but stay inside their quotes).
	return [header.map(csvField).join(','), ...rows].join('\r\n');
};

export const historyToJson = (data: AlertHistoryData[]): string =>
	JSON.stringify(
		data.map((entry) => ({
			date: entry.date,
			event: exportEventLabel(entry),
			branch: historyEntryLane(entry),
			status: entry.status ?? null,
			actor: entry.actorName ?? null,
			description: entry.description ?? null,
		})),
		null,
		2
	);
