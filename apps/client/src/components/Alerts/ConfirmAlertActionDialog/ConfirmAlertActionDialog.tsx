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
// re-silencing an alert always restarts the timer from "now".
export type SilenceDuration = 'midnight' | '1h' | '4h' | '8h' | 'forever';

const SILENCE_DURATION_OPTIONS: { value: SilenceDuration; label: string }[] = [
	{ value: 'midnight', label: 'Until midnight' },
	{ value: '1h', label: '1 hour' },
	{ value: '4h', label: '4 hours' },
	{ value: '8h', label: '8 hours' },
	{ value: 'forever', label: 'Forever (until unsilenced)' },
];

// null = no expiry (silenced until manually unsilenced).
const silencedUntilFor = (duration: SilenceDuration): string | null => {
	switch (duration) {
		case 'forever':
			return null;
		case 'midnight': {
			// Local midnight — the user thinks in their own day boundary, not UTC's.
			const endOfDay = new Date();
			endOfDay.setHours(24, 0, 0, 0);
			return endOfDay.toISOString();
		}
		case '1h':
			return new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();
		case '4h':
			return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
		case '8h':
			return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
	}
};

// A state-changing alert action awaiting the user's go-ahead. `run` executes it; for
// resolve/silence actions it receives the optional note the user typed, and for silence
// actions the computed expiry of the chosen duration (null = forever).
export interface PendingAlertAction {
	title: string;
	description: string;
	confirmLabel: string;
	// Destructive actions (permanent delete) get the red confirm button.
	destructive?: boolean;
	// Resolve/silence actions offer an optional note, stored as a comment on the alert(s).
	withComment?: boolean;
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
							{pending.commentLabel ?? 'Comment'}{' '}
							<span className="font-normal text-muted-foreground">(optional)</span>
						</label>
						<Textarea
							id="action-comment"
							value={comment}
							onChange={(e) => setComment(e.target.value)}
							placeholder={pending.commentPlaceholder ?? 'Add a note for your team'}
							rows={3}
							maxLength={5000}
						/>
					</div>
				)}

				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={() => {
							pending?.run(note, pending.withSilenceDuration ? silencedUntilFor(duration) : undefined);
							onClose();
						}}
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
