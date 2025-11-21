import { Alert } from '@OpsiMate/shared';

export interface AlertDetailsModalProps {
	alert: Alert | null;
	open: boolean;
	onClose: () => void;
	onDismiss?: (alertId: string) => void;
	onUndismiss?: (alertId: string) => void;
}
