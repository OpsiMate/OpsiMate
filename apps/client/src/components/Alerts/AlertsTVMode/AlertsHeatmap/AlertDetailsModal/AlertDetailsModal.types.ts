import { Alert } from '@OpsiMate/shared';

export interface AlertDetailsModalProps {
	alert: Alert | null;
	open: boolean;
	onClose: () => void;
	onSilence?: (alertId: string) => void;
	onUnsilence?: (alertId: string) => void;
}
