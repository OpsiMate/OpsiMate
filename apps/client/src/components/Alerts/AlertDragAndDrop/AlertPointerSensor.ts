import { PointerSensor, PointerSensorOptions } from '@dnd-kit/core';
import type { PointerEvent } from 'react';

// Presses that already mean something else in the table never start a drag: Cmd/Ctrl
// (drag-selection), Shift (range selection), the checkbox column (its own drag-select),
// and controls inside a row (owner picker, menus, links), plus anything but the primary
// button. Everything else — a plain press that then moves — drags the row.
const NOT_A_DRAG_HANDLE = '[data-select-cell], button, a, input, textarea, [role="checkbox"], [role="menuitem"]';

// The parts of a pointer press the gate looks at (a PointerEvent satisfies it).
interface AlertDragPress {
	button: number;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	target: EventTarget | null;
}

export const canStartAlertDrag = (event: AlertDragPress): boolean => {
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return false;
	const target = event.target as Element | null;
	return !target?.closest?.(NOT_A_DRAG_HANDLE);
};

export class AlertPointerSensor extends PointerSensor {
	static activators = [
		{
			eventName: 'onPointerDown' as const,
			handler: ({ nativeEvent }: PointerEvent, { onActivation }: PointerSensorOptions) => {
				if (!nativeEvent.isPrimary || !canStartAlertDrag(nativeEvent)) return false;
				onActivation?.({ event: nativeEvent });
				return true;
			},
		},
	];
}
