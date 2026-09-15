import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ROOT_CAUSE_RATING_COMMENT_MAX } from '@OpsiMate/shared';
import { Loader2, ThumbsDown } from 'lucide-react';
import { useEffect, useState } from 'react';

interface RootCauseFeedbackDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	// Called with the trimmed comment, or undefined when the operator skipped it. The
	// thumbs-down itself is submitted by the caller either way; the caller closes the
	// dialog on success and leaves it open (with `error`) on failure.
	onSubmit: (comment: string | undefined) => void;
	submitting: boolean;
	error: string | null;
}

// "What went wrong?" — shown after a thumbs-down. The comment is optional on purpose:
// the verdict is the signal that matters and must never be gated behind typing, so
// Skip sends the bare thumbs-down. What is typed here is relayed verbatim to the
// sender's feedback callback (and, in phase 2, becomes the eval note for the agent).
export const RootCauseFeedbackDialog = ({
	open,
	onOpenChange,
	onSubmit,
	submitting,
	error,
}: RootCauseFeedbackDialogProps) => {
	const [comment, setComment] = useState('');
	const trimmed = comment.trim();
	const overLimit = trimmed.length > ROOT_CAUSE_RATING_COMMENT_MAX;

	// The text is kept while a request is in flight or has failed (so a retry needs no
	// re-typing) and dropped only once the dialog is actually closed — whichever side
	// closed it.
	useEffect(() => {
		if (!open) setComment('');
	}, [open]);

	const submit = (withComment: boolean) => {
		if (submitting) return;
		onSubmit(withComment && trimmed ? trimmed : undefined);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<ThumbsDown className="h-4 w-4 text-red-600 dark:text-red-400" />
						What went wrong?
					</DialogTitle>
					<DialogDescription>
						Optional. Your note is sent back to whoever produced this analysis so the next one can be
						better.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-1.5">
					<Label htmlFor="root-cause-feedback">Feedback</Label>
					<Textarea
						id="root-cause-feedback"
						value={comment}
						onChange={(event) => setComment(event.target.value)}
						placeholder="e.g. It blamed the connection pool, but the pool was fine — the real cause was DNS."
						rows={4}
						autoFocus
						disabled={submitting}
						aria-invalid={overLimit}
						aria-describedby="root-cause-feedback-count"
					/>
					<p
						id="root-cause-feedback-count"
						className={overLimit ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}
					>
						{trimmed.length}/{ROOT_CAUSE_RATING_COMMENT_MAX}
					</p>
					{error && (
						<p role="alert" className="text-xs text-destructive">
							{error}
						</p>
					)}
				</div>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button type="button" variant="ghost" onClick={() => submit(false)} disabled={submitting}>
						Skip
					</Button>
					<Button type="button" onClick={() => submit(true)} disabled={submitting || overLimit}>
						{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Send feedback
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
