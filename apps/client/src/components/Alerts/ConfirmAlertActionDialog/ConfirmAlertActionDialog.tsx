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

// A state-changing alert action awaiting the user's go-ahead. `run` executes it.
export interface PendingAlertAction {
	title: string;
	description: string;
	confirmLabel: string;
	// Destructive actions (permanent delete) get the red confirm button.
	destructive?: boolean;
	run: () => void;
}

interface ConfirmAlertActionDialogProps {
	pending: PendingAlertAction | null;
	onClose: () => void;
}

// Confirmation gate for silence / resolve / delete: one dialog instance at the page level,
// fed by whichever entry point (row menu, details footer, bulk bar) requested the action.
export const ConfirmAlertActionDialog = ({ pending, onClose }: ConfirmAlertActionDialogProps) => (
	<AlertDialog open={!!pending} onOpenChange={(open) => !open && onClose()}>
		<AlertDialogContent>
			<AlertDialogHeader>
				<AlertDialogTitle>{pending?.title}</AlertDialogTitle>
				<AlertDialogDescription>{pending?.description}</AlertDialogDescription>
			</AlertDialogHeader>
			<AlertDialogFooter>
				<AlertDialogCancel>Cancel</AlertDialogCancel>
				<AlertDialogAction
					onClick={() => {
						pending?.run();
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
