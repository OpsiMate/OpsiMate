import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState } from 'react';

// How long a silence lasts. The expiry timestamp is computed at confirm time, so
// re-silencing an alert always restarts the timer from "now". Every choice expires —
// an indefinite "forever" option existed once and was removed on purpose.
export type SilenceDuration = 'midnight' | '5m' | '15m' | '30m' | '1h' | '2h' | '6h';

// Minutes from now for each fixed-length duration; 'midnight' is computed from the clock.
const DURATION_MINUTES: Record<Exclude<SilenceDuration, 'midnight'>, number> = {
	'5m': 5,
	'15m': 15,
	'30m': 30,
	'1h': 60,
	'2h': 120,
	'6h': 360,
};

const SILENCE_DURATION_OPTIONS: { value: SilenceDuration; label: string }[] = [
	{ value: 'midnight', label: 'Until midnight' },
	{ value: '5m', label: '5 minutes' },
	{ value: '15m', label: '15 minutes' },
	{ value: '30m', label: '30 minutes' },
	{ value: '1h', label: '1 hour' },
	{ value: '2h', label: '2 hours' },
	{ value: '6h', label: '6 hours' },
];

const silencedUntilFor = (duration: SilenceDuration): string => {
	if (duration === 'midnight') {
		// Local midnight — the user thinks in their own day boundary, not UTC's.
		const endOfDay = new Date();
		endOfDay.setHours(24, 0, 0, 0);
		return endOfDay.toISOString();
	}
	return new Date(Date.now() + DURATION_MINUTES[duration] * 60 * 1000).toISOString();
};

// A state-changing alert action awaiting the user's go-ahead. `run` executes it; for
// resolve/silence actions it receives the optional note the user typed, and for silence
// actions the computed expiry of the chosen duration (always an ISO timestamp here —
// the API still accepts null for no-expiry, used by quick-silence paths elsewhere).
export interface PendingAlertAction {
	title: string;
	description: string;
	confirmLabel: string;
	// Destructive actions (permanent delete) get the red confirm button.
	destructive?: boolean;
	// Resolve/silence actions offer an optional note, stored as a comment on the alert(s).
	withComment?: boolean;
	// For actions whose whole point is the note (bulk comment): confirm stays disabled
	// until something is typed, and the "(optional)" hint is dropped.
	requireComment?: boolean;
	commentLabel?: string;
	commentPlaceholder?: string;
	// Silence actions pick a duration (defaults to "until midnight").
	withSilenceDuration?: boolean;
	run: (comment?: string, silencedUntil?: string | null) => void;
}

interface ConfirmAlertActionDialogProps {
	pending: PendingAlertAction | null;
	onClose: () => void;
}

// Confirmation gate for silence / resolve / delete: one dialog instance at the page level,
// fed by whichever entry point (row menu, details footer, bulk bar) requested the action.
export const ConfirmAlertActionDialog = ({ pending, onClose }: ConfirmAlertActionDialogProps) => {
	const [comment, setComment] = useState('');
	const [duration, setDuration] = useState<SilenceDuration>('midnight');

	// Fresh state per confirmation — a note or duration chosen for one action must not
	// leak into the next.
	useEffect(() => {
		if (pending) {
			setComment('');
			setDuration('midnight');
		}
	}, [pending]);

	const note = comment.trim() || undefined;
	const confirmDisabled = !!pending?.requireComment && !note;

	const confirm = () => {
		if (!pending || confirmDisabled) return;
		pending.run(note, pending.withSilenceDuration ? silencedUntilFor(duration) : undefined);
		onClose();
	};

	return (
		<AlertDialog open={!!pending} onOpenChange={(open) => !open && onClose()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{pending?.title}</AlertDialogTitle>
					<AlertDialogDescription>{pending?.description}</AlertDialogDescription>
				</AlertDialogHeader>

				{pending?.withSilenceDuration && (
					<div className="space-y-1.5">
						<label htmlFor="silence-duration" className="text-sm font-medium">
							Silence for
						</label>
						<Select value={duration} onValueChange={(value) => setDuration(value as SilenceDuration)}>
							<SelectTrigger id="silence-duration">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{SILENCE_DURATION_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				{pending?.withComment && (
					<div className="space-y-1.5">
						<label htmlFor="action-comment" className="text-sm font-medium">
							{pending.commentLabel ?? 'Comment'}
							{!pending.requireComment && (
								<span className="font-normal text-muted-foreground"> (optional)</span>
							)}
						</label>
						<Textarea
							id="action-comment"
							value={comment}
							onChange={(e) => setComment(e.target.value)}
							onKeyDown={(e) => {
								// Enter confirms the action with the typed note; Shift+Enter keeps
								// its usual insert-a-newline meaning. Guarded against IME
								// composition, where Enter merely commits the composed text.
								if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
									e.preventDefault();
									confirm();
								}
							}}
							placeholder={pending.commentPlaceholder ?? 'Add a note for your team'}
							rows={3}
							maxLength={5000}
						/>
						<p className="text-xs text-muted-foreground">
							<kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[10px]">Enter</kbd> to{' '}
							{pending.confirmLabel.toLowerCase()} ·{' '}
							<kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[10px]">Shift+Enter</kbd>{' '}
							for a new line
						</p>
					</div>
				)}

				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={confirmDisabled}
						onClick={confirm}
						className={
							pending?.destructive
								? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
								: undefined
						}
					>
						{pending?.confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
