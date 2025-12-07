import { Alert } from '@OpsiMate/shared';

interface UseAlertSelectionProps {
	sortedAlerts: Alert[];
	selectedAlerts: Alert[];
	onSelectAlerts?: (alerts: Alert[]) => void;
}

export const useAlertSelection = ({ sortedAlerts, selectedAlerts, onSelectAlerts }: UseAlertSelectionProps) => {
	const handleSelectAll = () => {
		if (onSelectAlerts) {
			if (selectedAlerts.length === sortedAlerts.length) {
				onSelectAlerts([]);
			} else {
				onSelectAlerts(sortedAlerts);
			}
		}
	};

	const handleSelectAlert = (alert: Alert) => {
		if (onSelectAlerts) {
			const isSelected = selectedAlerts.some((a) => a.id === alert.id);
			if (isSelected) {
				onSelectAlerts(selectedAlerts.filter((a) => a.id !== alert.id));
			} else {
				onSelectAlerts([...selectedAlerts, alert]);
			}
		}
	};

	return {
		handleSelectAll,
		handleSelectAlert,
	};
};
