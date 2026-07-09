import { Separator } from '@/components/ui/separator';
import { Alert } from '@OpsiMate/shared';
import { AlertActions } from './AlertActions';

interface AlertActionsSectionProps {
	alert: Alert;
}

// The custom-actions section of the details body. The alert's primary buttons
// (dismiss/resolve/delete) live in AlertFooterActions, pinned at the panel's bottom.
export const AlertActionsSection = ({ alert }: AlertActionsSectionProps) => {
	return (
		<>
			<Separator />
			<AlertActions alert={alert} />
		</>
	);
};
