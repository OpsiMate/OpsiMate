import { Modifier } from '@dnd-kit/core';

// Where the pointer sits on the chip: over the grip icon (left padding + half the icon),
// vertically centred.
const GRIP_CENTER_X_PX = 20;

// dnd-kit places the drag overlay where the dragged row was and moves it by the pointer's
// delta, so a row grabbed mid-way leaves the chip stuck at the row's left edge. This
// re-anchors the overlay to the pointer's starting position instead.
export const followPointer: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
	if (!draggingNodeRect || !(activatorEvent instanceof MouseEvent)) return transform;
	const offsetX = activatorEvent.clientX - draggingNodeRect.left;
	const offsetY = activatorEvent.clientY - draggingNodeRect.top;
	return {
		...transform,
		x: transform.x + offsetX - GRIP_CENTER_X_PX,
		y: transform.y + offsetY - draggingNodeRect.height / 2,
	};
};
