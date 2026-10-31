import { Dialog, DialogContent } from '@/components/ui/dialog';
import { IncidentDialogTarget } from './IncidentDialog.types';
import { IncidentForm } from './IncidentForm';

interface IncidentDialogProps {
	// null = closed.
	target: IncidentDialogTarget | null;
	onOpenChange: (open: boolean) => void;
	onSubmit: (name: string, description: string) => void;
	isSubmitting?: boolean;
}

// Name + details form shared by "Group into incident" and "Edit incident". Creating
// needs no wording — both fields are optional and the server names an unnamed incident
// "Incident #<id>" — so grouping is never blocked on typing.
export const IncidentDialog = ({ target, onOpenChange, onSubmit, isSubmitting }: IncidentDialogProps) => (
	<Dialog open={target !== null} onOpenChange={onOpenChange}>
		<DialogContent className="sm:max-w-md">
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
