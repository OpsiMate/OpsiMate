import { Alert, IncidentSummary } from '@OpsiMate/shared';
import { DragEndEvent, DragStartEvent, useSensor, useSensors } from '@dnd-kit/core';
import { useRef, useState } from 'react';
import { AlertDragData, AlertPointerSensor, DropAction, incidentsDissolvedBy, resolveDrop } from '../AlertDragAndDrop';
import { IncidentDialogPreset } from '../IncidentDialog';

interface UseAlertDragAndDropProps {
	selectedAlerts: Alert[];
	onSelectAlerts: (alerts: Alert[]) => void;
	alertsById: Map<string, Alert>;
	incidents: IncidentSummary[];
	// The incident actions a drop turns into (see useIncidentActions).
	addAlertsToIncident: (alerts: Alert[], incidentId: number) => Promise<void>;
	removeAlertsFromIncidents: (alerts: Alert[]) => Promise<void>;
	openCreateDialogFor: (alerts: Alert[], preset?: IncidentDialogPreset) => void;
	// Unowned alerts dropped on the Assigned pane become the current user's.
	assignAlertsToMe: (alerts: Alert[]) => Promise<void>;
}

// Pointer must travel this far before a press becomes a drag; a shorter move is a click.
const DRAG_DISTANCE_PX = 8;

// Dragging alert rows onto incident folders, other rows, or the drop tray. The set
// being dragged is the selection when the pressed row is part of it, else just that row
// (which then becomes the selection, like a click). What a drop means is decided by
// resolveDrop; anything that would dissolve an incident, and every "new incident" drop,
// goes through the dialog so the user sees the warning / can name it.
export const useAlertDragAndDrop = ({
	selectedAlerts,
	onSelectAlerts,
	alertsById,
	incidents,
	...actions
}: UseAlertDragAndDropProps) => {
	const [dragging, setDragging] = useState<Alert[] | null>(null);
	// The drag-end handler runs from a dnd-kit listener, so it reads the set from a ref
	// rather than from state that may lag a render.
	const draggingRef = useRef<Alert[] | null>(null);
	const sensors = useSensors(useSensor(AlertPointerSensor, { activationConstraint: { distance: DRAG_DISTANCE_PX } }));

	const startDrag = (alerts: Alert[]) => {
		draggingRef.current = alerts;
		setDragging(alerts);
	};
	const endDrag = () => {
		const alerts = draggingRef.current;
		draggingRef.current = null;
		setDragging(null);
		return alerts;
	};

	const onDragStart = ({ active }: DragStartEvent) => {
		const alert = (active.data.current as AlertDragData | undefined)?.alert;
		if (!alert) return;
		const inSelection = selectedAlerts.some((a) => a.id === alert.id);
		if (!inSelection) onSelectAlerts([alert]);
		startDrag(inSelection ? selectedAlerts : [alert]);
	};

	const onDragCancel = () => {
		endDrag();
	};

	const onDragEnd = async ({ over, collisions }: DragEndEvent) => {
		const alerts = endDrag();
		if (!alerts) return;
		// Every target under the pointer, most specific first (the collision detection
		// already ordered them); a row inside a pane is tried before the pane itself.
		const overIds = collisions?.length ? collisions.map((c) => String(c.id)) : over ? [String(over.id)] : [];
		const action = resolveDrop(overIds, alerts, alertsById);
		if (action) await performDrop(action, alerts, incidents, actions);
	};

	return { sensors, dragging, onDragStart, onDragEnd, onDragCancel };
};

type DropActions = Pick<
	UseAlertDragAndDropProps,
	'addAlertsToIncident' | 'removeAlertsFromIncidents' | 'openCreateDialogFor' | 'assignAlertsToMe'
>;

// Carries a resolved drop out. Moving the last members out of an incident dissolves it,
// so such drops go through the dialog, opened on the drop's own destination: it warns,
// and confirming does what the drop meant.
const performDrop = async (
	action: DropAction,
	dragged: Alert[],
	incidents: IncidentSummary[],
	actions: DropActions
) => {
	switch (action.kind) {
		case 'create':
			return actions.openCreateDialogFor(action.alerts);
		case 'add':
			if (incidentsDissolvedBy(dragged, incidents, action.incidentId).length > 0) {
				return actions.openCreateDialogFor(dragged, { destination: 'existing', incidentId: action.incidentId });
			}
			return actions.addAlertsToIncident(dragged, action.incidentId);
		case 'remove':
			if (incidentsDissolvedBy(action.alerts, incidents).length > 0) {
				return actions.openCreateDialogFor(action.alerts, { destination: 'remove' });
			}
			return actions.removeAlertsFromIncidents(action.alerts);
		case 'assign':
			return actions.assignAlertsToMe(action.alerts);
	}
};
