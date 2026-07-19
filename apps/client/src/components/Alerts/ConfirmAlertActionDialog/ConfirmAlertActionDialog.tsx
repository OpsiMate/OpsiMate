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
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState } from 'react';

// A state-changing alert action awaiting the user's go-ahead. `run` executes it; for
// resolve actions it receives the optional resolve note the user typed.
export interface PendingAlertAction {
	title: string;
	description: string;
	confirmLabel: string;
	// Destructive actions (permanent delete) get the red confirm button.
	destructive?: boolean;
	// Resolve actions offer an optional note, stored as a comment on the resolved alert(s).
	withComment?: boolean;
	run: (comment?: string) => void;
}

interface ConfirmAlertActionDialogProps {
	pending: PendingAlertAction | null;
	onClose: () => void;
}

// Confirmation gate for silence / resolve / delete: one dialog instance at the page level,
// fed by whichever entry point (row menu, details footer, bulk bar) requested the action.
export const ConfirmAlertActionDialog = ({ pending, onClose }: ConfirmAlertActionDialogProps) => {
	const [comment, setComment] = useState('');

	// Fresh state per confirmation — a note typed for one resolve must not leak into the next.
	useEffect(() => {
		if (pending) {
			setComment('');
		}
	}, [pending]);

	const resolveNote = comment.trim() || undefined;

	return (
		<AlertDialog open={!!pending} onOpenChange={(open) => !open && onClose()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{pending?.title}</AlertDialogTitle>
					<AlertDialogDescription>{pending?.description}</AlertDialogDescription>
				</AlertDialogHeader>

				{pending?.withComment && (
					<div className="space-y-1.5">
						<label htmlFor="resolve-comment" className="text-sm font-medium">
							Resolve comment <span className="font-normal text-muted-foreground">(optional)</span>
						</label>
						<Textarea
							id="resolve-comment"
							value={comment}
							onChange={(e) => setComment(e.target.value)}
							placeholder="What fixed it / why is this resolved?"
							rows={3}
							maxLength={5000}
						/>
					</div>
				)}

				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={() => {
							pending?.run(resolveNote);
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
