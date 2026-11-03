import { Dialog, DialogContent } from '@/components/ui/dialog';
import { IncidentDialogTarget, IncidentFormResult } from './IncidentDialog.types';
import { IncidentForm } from './IncidentForm';

interface IncidentDialogProps {
	// null = closed.
	target: IncidentDialogTarget | null;
	onOpenChange: (open: boolean) => void;
	onSubmit: (result: IncidentFormResult) => void;
	isSubmitting?: boolean;
}

// One dialog for everything incident: group the selection into a NEW incident or add it
// to an EXISTING one (the form asks which), and edit an incident's name and details.
export const IncidentDialog = ({ target, onOpenChange, onSubmit, isSubmitting }: IncidentDialogProps) => (
	<Dialog open={target !== null} onOpenChange={onOpenChange}>
		<DialogContent className="overflow-hidden sm:max-w-md">
			{/* The form lives inside the content, which unmounts on close: every opening
			    starts from the target's values, with nothing left over from the last one. */}
			{target && (
				<IncidentForm
					target={target}
					onCancel={() => onOpenChange(false)}
					onSubmit={onSubmit}
					isSubmitting={isSubmitting}
				/>
			)}
		</DialogContent>
	</Dialog>
);
