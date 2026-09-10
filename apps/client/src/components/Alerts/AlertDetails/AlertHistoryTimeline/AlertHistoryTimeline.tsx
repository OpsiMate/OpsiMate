import { formatLongDateTime, formatShortDateTime } from '@/lib/datetime';
import { buildHistoryGraph, HistoryLaneFilter } from './alertHistory.utils';
import { AlertHistoryData, AlertHistoryEventType, AlertStatus } from '@OpsiMate/shared';
import {
	Activity,
	Bell,
	BellOff,
	CheckCircle2,
	Flame,
	MessageSquare,
	RefreshCw,
	UserMinus,
	UserPlus,
	Zap,
} from 'lucide-react';
import { ComponentType } from 'react';

interface AlertHistoryTimelineProps {
	// Already filtered by the active time range; rendered newest-first.
	data: AlertHistoryData[];
	// True when a time filter is narrowing the list, so the empty state can say so.
	isFiltered?: boolean;
	// 'all' renders the two-branch git-style graph; a single lane renders flat.
	laneFilter?: HistoryLaneFilter;
}

const formatFullDate = (dateStr: string) => formatLongDateTime(dateStr);

// Descriptions may embed machine ISO timestamps (e.g. "Alert silenced until
// 2026-07-19T09:23:39.487Z"); show them as short datetimes in the viewer's timezone.
const ISO_TIMESTAMP_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})/g;
const humanizeTimestamps = (text: string): string =>
	text.replace(ISO_TIMESTAMP_RE, (iso) => formatShortDateTime(iso, iso));

interface EventStyle {
	label: string;
	dotClass: string;
	textClass: string;
	Icon: ComponentType<{ className?: string }>;
}

const EVENT_STYLES: Record<Exclude<AlertHistoryEventType, AlertHistoryEventType.STATUS_CHANGED>, EventStyle> = {
	[AlertHistoryEventType.OWNER_ASSIGNED]: {
		label: 'Owner assigned',
		dotClass: 'bg-blue-500',
		textClass: 'text-blue-600 dark:text-blue-400',
		Icon: UserPlus,
	},
	[AlertHistoryEventType.OWNER_UNASSIGNED]: {
		label: 'Owner removed',
		dotClass: 'bg-slate-400',
		textClass: 'text-slate-600 dark:text-slate-300',
		Icon: UserMinus,
	},
	[AlertHistoryEventType.SILENCED]: {
		label: 'Silenced',
		dotClass: 'bg-amber-500',
		textClass: 'text-amber-600 dark:text-amber-400',
		Icon: BellOff,
	},
	[AlertHistoryEventType.UNSILENCED]: {
		label: 'Unsilenced',
		dotClass: 'bg-rose-500',
		textClass: 'text-rose-600 dark:text-rose-400',
		Icon: Bell,
	},
	// A user manually resolved the alert (API/source-driven resolution renders as a
	// STATUS_CHANGED "Resolved" entry instead, without an actor).
	[AlertHistoryEventType.RESOLVED]: {
		label: 'Resolved',
		dotClass: 'bg-green-500',
		textClass: 'text-green-600 dark:text-green-400',
		Icon: CheckCircle2,
	},
	[AlertHistoryEventType.UNRESOLVED]: {
		label: 'Unresolved',
		dotClass: 'bg-red-500',
		textClass: 'text-red-600 dark:text-red-400',
		Icon: Flame,
	},
	[AlertHistoryEventType.ACTION_RUN]: {
		label: 'Action run',
		dotClass: 'bg-violet-500',
		textClass: 'text-violet-600 dark:text-violet-400',
		Icon: Zap,
	},
	[AlertHistoryEventType.UPDATED]: {
		label: 'Updated',
		dotClass: 'bg-sky-500',
		textClass: 'text-sky-600 dark:text-sky-400',
		Icon: Activity,
	},
	[AlertHistoryEventType.COMMENT_ADDED]: {
		label: 'Comment added',
		dotClass: 'bg-sky-500',
		textClass: 'text-sky-600 dark:text-sky-400',
		Icon: MessageSquare,
	},
};

// Resolves the visual style + label for a history entry. Status transitions are colored by
// their resulting status; everything else uses the per-event-type style above.
const resolveStyle = (item: AlertHistoryData): EventStyle => {
	const eventType = item.eventType ?? AlertHistoryEventType.STATUS_CHANGED;
	if (eventType === AlertHistoryEventType.STATUS_CHANGED) {
		const isFiring = item.status === AlertStatus.FIRING;
		return {
			label: isFiring ? 'Firing' : 'Resolved',
			dotClass: isFiring ? 'bg-red-500' : 'bg-green-500',
			textClass: isFiring ? 'text-red-500' : 'text-green-500',
			Icon: RefreshCw,
		};
	}
	return EVENT_STYLES[eventType] ?? EVENT_STYLES[AlertHistoryEventType.ACTION_RUN];
};

// Rail geometry, shared by the rails and the connector corners. The dot centers sit at
// MAIN_X / SIDE_X; DOT_CENTER_Y is where a row's dot center lands vertically (mt-1 on an
// h-2.5 dot). Everything is drawn from these so the curves stay attached to the dots.
const MAIN_X = 5;
const SIDE_X = 33;
const DOT_CENTER_Y = 9;

// The side branch is drawn in its own color, like a branch in a git graph — offset
// alone was too subtle to read as a second lane. Rails/corners split into vertical and
// horizontal pieces so both can carry the tint.
const SIDE_BRANCH_BORDER = 'border-sky-400/70 dark:border-sky-500/60';
const SIDE_BRANCH_BG = 'bg-sky-400/70 dark:bg-sky-500/60';

// The event's text block, identical for both branches.
const EventBody = ({ item, style }: { item: AlertHistoryData; style: EventStyle }) => {
	const { Icon } = style;
	return (
		<div className="flex-1 min-w-0 -mt-0.5">
			<div className={`flex items-center gap-1.5 text-sm font-medium ${style.textClass}`}>
				<Icon className="h-3.5 w-3.5 shrink-0" />
				<span>{style.label}</span>
			</div>
			{item.description && (
				<div className="text-xs text-foreground/80">{humanizeTimestamps(item.description)}</div>
			)}
			<div className="text-xs text-muted-foreground">
				{formatFullDate(item.date)}
				{item.actorName ? ` · by ${item.actorName}` : ''}
			</div>
		</div>
	);
};

// Vertical timeline of an alert's history, drawn like a git graph. The MAIN branch (left
// rail) is the alert's own story: firing, resolved, unresolved. Everything users did
// around it — comments, silences, ownership, actions — branches off to a SIDE rail:
// the newest entry of a run curves out of the main rail, entries in between share a
// straight side rail, and the oldest curves back in, reading as branched-and-merged.
// When a single lane is filtered, that lane renders as a flat one-rail timeline.
export const AlertHistoryTimeline = ({ data, isFiltered, laneFilter = 'all' }: AlertHistoryTimelineProps) => {
	if (!data.length) {
		// Name what is actually missing: with a lane isolated, "no history available"
		// would read as a bug when the OTHER lane visibly has entries.
		const laneNoun =
			laneFilter === 'lifecycle'
				? 'status changes'
				: laneFilter === 'activity'
					? 'user activity'
					: 'history events';
		return (
			<div className="px-4 py-6 text-center text-sm text-muted-foreground">
				{isFiltered
					? `No ${laneNoun} in the selected time range`
					: laneFilter === 'all'
						? 'No alert history available'
						: `No ${laneNoun} for this alert`}
			</div>
		);
	}

	const graph = buildHistoryGraph(data);
	// A single-lane view has no second branch to draw — every row sits on the main rail.
	const flat = laneFilter !== 'all';

	return (
		<div className="border border-border rounded-lg bg-background overflow-y-auto max-h-[300px] p-4">
			<ol className="relative">
				{graph.map((row, index) => {
					const style = resolveStyle(row.entry);
					const isLast = index === graph.length - 1;
					const side = !flat && row.lane === 'activity';
					const dotX = side ? SIDE_X : MAIN_X;
					return (
						<li key={index} className="relative flex gap-3 pb-4 last:pb-0">
							{/* Main rail: continuous through every row; stops at the last dot. */}
							{!isLast && (
								<span
									className="absolute w-px bg-border"
									style={{ left: MAIN_X, top: DOT_CENTER_Y, bottom: 0 }}
								/>
							)}
							{side && row.sideRunStart && (
								/* Branch-out corner: leaves the main rail above, curves right
								   into this dot — border-l is the vertical part on the main
								   rail, border-b the horizontal run into the dot. */
								<span
									className={`absolute border-l-2 border-b-2 ${SIDE_BRANCH_BORDER} rounded-bl-[14px]`}
									style={{
										left: MAIN_X,
										width: SIDE_X - MAIN_X + 4,
										top: -10,
										height: DOT_CENTER_Y + 10,
									}}
								/>
							)}
							{side && !row.sideRunStart && (
								/* Side rail from the previous (newer) side entry down to this dot. */
								<span
									className={`absolute w-0.5 ${SIDE_BRANCH_BG}`}
									style={{ left: SIDE_X, top: -10, height: DOT_CENTER_Y + 10 }}
								/>
							)}
							{side && !row.sideRunEnd && (
								/* Side rail onward to the next (older) side entry. */
								<span
									className={`absolute w-0.5 ${SIDE_BRANCH_BG}`}
									style={{ left: SIDE_X, top: DOT_CENTER_Y, bottom: 0 }}
								/>
							)}
							{side && row.sideRunEnd && !isLast && (
								/* Merge-back corner: curves left out of this dot and joins the
								   main rail below — the run's closing bracket. */
								<span
									className={`absolute border-t-2 border-l-2 ${SIDE_BRANCH_BORDER} rounded-tl-[14px]`}
									style={{
										left: MAIN_X,
										width: SIDE_X - MAIN_X + 4,
										top: DOT_CENTER_Y,
										height: 18,
									}}
								/>
							)}
							{/* Dot, on whichever rail this row belongs to. Main-branch dots are a
							    size up: the alert's own story carries more visual weight than
							    the activity around it. */}
							<span
								className={`relative z-10 shrink-0 rounded-full ring-2 ring-background ${style.dotClass} ${
									side ? 'mt-1 h-2.5 w-2.5' : 'mt-[3px] h-3 w-3'
								}`}
								style={{ marginLeft: dotX - MAIN_X }}
							/>
							<EventBody item={row.entry} style={style} />
						</li>
					);
				})}
			</ol>
		</div>
	);
};
