import { Alert } from '@OpsiMate/shared';
import { useMemo, useRef } from 'react';

interface UseAlertSelectionProps {
	sortedAlerts: Alert[];
	// Rows in on-screen order (collapsed groups excluded) — the order a shift-click
	// range runs over. Defaults to sortedAlerts.
	visibleAlerts?: Alert[];
	selectedAlerts: Alert[];
	onSelectAlerts?: (alerts: Alert[]) => void;
}

// Selection is shared across tables (the split-by-owner view renders two panes over one
// selection), so everything here is membership-based and pane-scoped: count comparisons
// lit the other pane's select-all whenever the totals happened to match, and select-all
// used to REPLACE the shared selection, dropping the other pane's picks.
export const useAlertSelection = ({
	sortedAlerts,
	visibleAlerts = sortedAlerts,
	selectedAlerts,
	onSelectAlerts,
}: UseAlertSelectionProps) => {
	const selectedIds = useMemo(() => new Set(selectedAlerts.map((alert) => alert.id)), [selectedAlerts]);
	// The last row toggled one-by-one (checkbox or Cmd/Ctrl+click); shift-click ranges start here.
	const anchorIdRef = useRef<string | null>(null);

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
			anchorIdRef.current = alert.id;
			const isSelected = selectedIds.has(alert.id);
			if (isSelected) {
				onSelectAlerts(selectedAlerts.filter((a) => a.id !== alert.id));
			} else {
				onSelectAlerts([...selectedAlerts, alert]);
			}
		}
	};

	// Shift+click: select every visible row from the anchor to this one (inclusive). Union,
	// like select-all, so earlier picks and the other pane's selection survive. With no
	// anchor in view (first click, or its group collapsed) it falls back to a plain toggle.
	const handleSelectRange = (alert: Alert) => {
		if (!onSelectAlerts) return;
		const anchorIndex = visibleAlerts.findIndex((a) => a.id === anchorIdRef.current);
		const targetIndex = visibleAlerts.findIndex((a) => a.id === alert.id);
		if (anchorIndex === -1 || targetIndex === -1) {
			handleSelectAlert(alert);
			return;
		}
		const [from, to] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
		const missing = visibleAlerts.slice(from, to + 1).filter((a) => !selectedIds.has(a.id));
		if (missing.length > 0) onSelectAlerts([...selectedAlerts, ...missing]);
	};

	return {
		allSelected,
		handleSelectAll,
		handleSelectAlert,
		handleSelectRange,
	};
};
