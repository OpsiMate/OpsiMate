import { Alert } from '@OpsiMate/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDragSelectionProps {
	selectedAlerts: Alert[];
	onSelectAlerts?: (alerts: Alert[]) => void;
}

interface DragState {
	isMouseDown: boolean;
	hasMoved: boolean;
	mode: 'select' | 'deselect' | null;
	startAlertId: string | null;
	startAlert: Alert | null;
	touchedAlertIds: Set<string>;
}

export const useDragSelection = ({ selectedAlerts, onSelectAlerts }: UseDragSelectionProps) => {
	const [isDragging, setIsDragging] = useState(false);
	const dragStateRef = useRef<DragState>({
		isMouseDown: false,
		hasMoved: false,
		mode: null,
		startAlertId: null,
		startAlert: null,
		touchedAlertIds: new Set(),
	});

	// Keep a ref to the latest selectedAlerts to avoid stale closures
	const selectedAlertsRef = useRef(selectedAlerts);
	useEffect(() => {
		selectedAlertsRef.current = selectedAlerts;
	}, [selectedAlerts]);

	const handleDragStart = useCallback(
		(alert: Alert, e: React.MouseEvent) => {
			if (!onSelectAlerts) return;

			e.preventDefault();
			const isCurrentlySelected = selectedAlertsRef.current.some((a) => a.id === alert.id);
			const mode = isCurrentlySelected ? 'deselect' : 'select';

			dragStateRef.current = {
				isMouseDown: true,
				hasMoved: false,
				mode,
				startAlertId: alert.id,
				startAlert: alert,
				touchedAlertIds: new Set([alert.id]),
			};
		},
		[onSelectAlerts]
	);

	const handleDragEnter = useCallback(
		(alert: Alert) => {
			if (!dragStateRef.current.isMouseDown || !onSelectAlerts) return;

			// Skip if we've already processed this alert during this drag
			if (dragStateRef.current.touchedAlertIds.has(alert.id)) return;

			// If entering a different alert than the start, it's a drag
			if (alert.id !== dragStateRef.current.startAlertId) {
				// First move - apply selection to the start alert and set dragging state
				if (!dragStateRef.current.hasMoved) {
					dragStateRef.current.hasMoved = true;
					setIsDragging(true);

					// Select/deselect the start alert first
					const startAlert = dragStateRef.current.startAlert;
					if (startAlert) {
						const currentSelected = selectedAlertsRef.current;
						const isStartSelected = currentSelected.some((a) => a.id === startAlert.id);
						if (dragStateRef.current.mode === 'select' && !isStartSelected) {
							selectedAlertsRef.current = [...currentSelected, startAlert];
							onSelectAlerts(selectedAlertsRef.current);
						} else if (dragStateRef.current.mode === 'deselect' && isStartSelected) {
							selectedAlertsRef.current = currentSelected.filter((a) => a.id !== startAlert.id);
							onSelectAlerts(selectedAlertsRef.current);
						}
					}
				}

				// Mark this alert as touched
				dragStateRef.current.touchedAlertIds.add(alert.id);

				// Apply selection to the current alert (use fresh ref)
				const { mode } = dragStateRef.current;
				const latestSelected = selectedAlertsRef.current;
				const isCurrentlySelected = latestSelected.some((a) => a.id === alert.id);

				if (mode === 'select' && !isCurrentlySelected) {
					selectedAlertsRef.current = [...latestSelected, alert];
					onSelectAlerts(selectedAlertsRef.current);
				} else if (mode === 'deselect' && isCurrentlySelected) {
					selectedAlertsRef.current = latestSelected.filter((a) => a.id !== alert.id);
					onSelectAlerts(selectedAlertsRef.current);
				}
			}
		},
		[onSelectAlerts]
	);

	const handleDragEnd = useCallback((onSelectAlert?: (alert: Alert) => void) => {
		// If mouse was down but didn't move, it's a click - toggle the start alert
		if (dragStateRef.current.isMouseDown && !dragStateRef.current.hasMoved && dragStateRef.current.startAlert) {
			if (onSelectAlert) {
				onSelectAlert(dragStateRef.current.startAlert);
			}
		}

		dragStateRef.current = {
			isMouseDown: false,
			hasMoved: false,
			mode: null,
			startAlertId: null,
			startAlert: null,
			touchedAlertIds: new Set(),
		};
		setIsDragging(false);
	}, []);

	return {
		isDragging,
		handleDragStart,
		handleDragEnter,
		handleDragEnd,
	};
};
