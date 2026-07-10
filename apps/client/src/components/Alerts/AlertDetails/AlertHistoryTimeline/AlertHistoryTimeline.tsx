import { AlertHistoryData, AlertHistoryEventType, AlertStatus } from '@OpsiMate/shared';
import { Bell, BellOff, Flame, MessageSquare, RefreshCw, UserMinus, UserPlus, Zap } from 'lucide-react';
import { ComponentType } from 'react';

interface AlertHistoryTimelineProps {
	// Already filtered by the active time range; rendered newest-first.
	data: AlertHistoryData[];
	// True when a time filter is narrowing the list, so the empty state can say so.
	isFiltered?: boolean;
}

const formatFullDate = (dateStr: string) =>
	new Date(dateStr).toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

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

// Vertical timeline of an alert's history: status transitions plus user-driven events
// (ownership, silencings, actions, comments). Most recent first.
export const AlertHistoryTimeline = ({ data, isFiltered }: AlertHistoryTimelineProps) => {
	if (!data.length) {
		return (
			<div className="px-4 py-6 text-center text-sm text-muted-foreground">
				{isFiltered ? 'No history events in the selected time range' : 'No alert history available'}
			</div>
		);
	}

	return (
		<div className="border border-border rounded-lg bg-background overflow-y-auto max-h-[300px] p-4">
			<ol className="relative">
				{data.map((item, index) => {
					const style = resolveStyle(item);
					const { Icon } = style;
					const isLast = index === data.length - 1;
					return (
						<li key={index} className="relative flex gap-3 pb-4 last:pb-0">
							{/* connector line */}
							{!isLast && <span className="absolute left-[5px] top-3 bottom-0 w-px bg-border" />}
							{/* node */}
							<span
								className={`relative z-10 mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ring-2 ring-background ${style.dotClass}`}
							/>
							<div className="flex-1 min-w-0 -mt-0.5">
								<div className={`flex items-center gap-1.5 text-sm font-medium ${style.textClass}`}>
									<Icon className="h-3.5 w-3.5 flex-shrink-0" />
									<span>{style.label}</span>
								</div>
								{item.description && (
									<div className="text-xs text-foreground/80">{item.description}</div>
								)}
								<div className="text-xs text-muted-foreground">
									{formatFullDate(item.date)}
									{item.actorName ? ` · by ${item.actorName}` : ''}
								</div>
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
};
