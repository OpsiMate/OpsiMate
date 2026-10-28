import { Alert } from '@OpsiMate/shared';
import { useCallback, useMemo, useRef } from 'react';

interface UseAlertSelectionProps {
	sortedAlerts: Alert[];
	// Rows in on-screen order (collapsed groups excluded) — the order a shift-click
	// range runs over. Defaults to sortedAlerts.
	visibleAlerts?: Alert[];
	selectedAlerts: Alert[];
	onSelectAlerts?: (alerts: Alert[]) => void;
}

// The rows from one id to the other (inclusive, either direction), or null if either is not in `rows`.
const rowsBetween = (rows: Alert[], fromId: string, toId: string): Alert[] | null => {
	const a = rows.findIndex((row) => row.id === fromId);
	const b = rows.findIndex((row) => row.id === toId);
	if (a === -1 || b === -1) return null;
	return rows.slice(Math.min(a, b), Math.max(a, b) + 1);
};

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
	// Where a shift-click range starts: the last row toggled one-by-one (checkbox or
	// Cmd/Ctrl+click) or the last row a drag selection touched.
	const anchorIdRef = useRef<string | null>(null);
	const setAnchor = useCallback((alert: Alert) => {
		anchorIdRef.current = alert.id;
	}, []);

	// True only when every row of THIS table is selected — regardless of what else is.
	const allSelected = sortedAlerts.length > 0 && sortedAlerts.every((alert) => selectedIds.has(alert.id));

	// Union into the shared selection: earlier picks and the other pane's survive.
	const addToSelection = (alerts: Alert[]) => {
		const missing = alerts.filter((alert) => !selectedIds.has(alert.id));
		if (missing.length > 0) onSelectAlerts?.([...selectedAlerts, ...missing]);
	};

	const handleSelectAll = () => {
		if (!onSelectAlerts) return;
		if (allSelected) {
			// Unselect only this table's rows; other panes keep their selection.
			const ownIds = new Set(sortedAlerts.map((alert) => alert.id));
			onSelectAlerts(selectedAlerts.filter((alert) => !ownIds.has(alert.id)));
		} else {
			addToSelection(sortedAlerts);
		}
	};

	const handleSelectAlert = (alert: Alert) => {
		if (!onSelectAlerts) return;
		anchorIdRef.current = alert.id;
		const isSelected = selectedIds.has(alert.id);
		onSelectAlerts(isSelected ? selectedAlerts.filter((a) => a.id !== alert.id) : [...selectedAlerts, alert]);
	};

	// Shift+click: select every visible row from the anchor to this one (inclusive), added
	// to the selection like select-all. With no usable anchor it falls back to a plain
	// toggle: none yet, its group collapsed, or it is no longer selected (unselected since,
	// or the whole selection was cleared, e.g. by a bulk action).
	const handleSelectRange = (alert: Alert) => {
		if (!onSelectAlerts) return;
		const anchorId = anchorIdRef.current;
		const range = anchorId && selectedIds.has(anchorId) ? rowsBetween(visibleAlerts, anchorId, alert.id) : null;
		if (range) addToSelection(range);
		else handleSelectAlert(alert);
	};

	return {
		allSelected,
		handleSelectAll,
		handleSelectAlert,
		handleSelectRange,
		setAnchor,
	};
};
