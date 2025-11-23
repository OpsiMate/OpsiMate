import { AlertDetails } from '@/components/Alerts/AlertDetails';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDetailsModalProps } from './AlertDetailsModal.types';

export const AlertDetailsModal = ({ alert, open, onClose, onDismiss, onUndismiss }: AlertDetailsModalProps) => {
	if (!alert) return null;

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden" showClose={false}>
				<AlertDetails alert={alert} onClose={onClose} onDismiss={onDismiss} onUndismiss={onUndismiss} />
			</DialogContent>
		</Dialog>
	);
};
