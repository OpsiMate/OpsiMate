import { useDndContext, useDroppable } from '@dnd-kit/core';
import { INACTIVE_PANE_DROP_ID } from '../AssignmentPane.constants';

// The pane as a drop target. Lit while the pointer is anywhere inside it — including over
// its rows, which win as the "over" target but still mean the pane (see resolveDrop).
export const usePaneDropTarget = (dropTargetId: string | undefined, dropActive: boolean) => {
	const { setNodeRef } = useDroppable({ id: dropTargetId ?? INACTIVE_PANE_DROP_ID, disabled: !dropTargetId });
	const { collisions } = useDndContext();
	const isWithin = dropTargetId != null && (collisions?.some((collision) => collision.id === dropTargetId) ?? false);
	const dropClass = dropActive && isWithin && 'ring-2 ring-inset ring-primary rounded-lg bg-primary/5';
	return { setNodeRef, dropClass };
};
