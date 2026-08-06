import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';

interface UseAlertSelectionProps {
	sortedAlerts: Alert[];
	selectedAlerts: Alert[];
	onSelectAlerts?: (alerts: Alert[]) => void;
}

// Selection is shared across tables (the split-by-owner view renders two panes over one
// selection), so everything here is membership-based and pane-scoped: count comparisons
// lit the other pane's select-all whenever the totals happened to match, and select-all
// used to REPLACE the shared selection, dropping the other pane's picks.
export const useAlertSelection = ({ sortedAlerts, selectedAlerts, onSelectAlerts }: UseAlertSelectionProps) => {
	const selectedIds = useMemo(() => new Set(selectedAlerts.map((alert) => alert.id)), [selectedAlerts]);

	// True only when every row of THIS table is selected — regardless of what else is.
	const allSelected = sortedAlerts.length > 0 && sortedAlerts.every((alert) => selectedIds.has(alert.id));

	const handleSelectAll = () => {
		if (!onSelectAlerts) return;
		if (allSelected) {
			// Unselect only this table's rows; other panes keep their selection.
			const ownIds = new Set(sortedAlerts.map((alert) => alert.id));
			onSelectAlerts(selectedAlerts.filter((alert) => !ownIds.has(alert.id)));
		} else {
			// Union: add this table's missing rows without dropping other panes' picks.
			const missing = sortedAlerts.filter((alert) => !selectedIds.has(alert.id));
			onSelectAlerts([...selectedAlerts, ...missing]);
		}
	};

	const handleSelectAlert = (alert: Alert) => {
		if (onSelectAlerts) {
			const isSelected = selectedIds.has(alert.id);
			if (isSelected) {
				onSelectAlerts(selectedAlerts.filter((a) => a.id !== alert.id));
			} else {
				onSelectAlerts([...selectedAlerts, alert]);
			}
		}
	};

	return {
		allSelected,
		handleSelectAll,
		handleSelectAlert,
	};
};
