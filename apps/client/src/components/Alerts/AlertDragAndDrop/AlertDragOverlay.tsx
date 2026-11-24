import { Badge } from '@/components/ui/badge';
import { pluralize } from '@/lib/text';
import { Alert } from '@OpsiMate/shared';
import { DragOverlay } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { followPointer } from './followPointer';

interface AlertDragOverlayProps {
	// The alerts being dragged; null when nothing is.
	dragging: Alert[] | null;
}

// What follows the pointer during a drag: the count, and the name when it is one alert.
export const AlertDragOverlay = ({ dragging }: AlertDragOverlayProps) => (
	<DragOverlay dropAnimation={null} modifiers={[followPointer]}>
		{dragging && (
			<div className="pointer-events-none inline-flex max-w-xs items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm shadow-lg">
				<GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
				<span className="truncate">{dragging.length === 1 ? dragging[0].alertName : 'Alerts'}</span>
				<Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-xs">
					{dragging.length} {pluralize(dragging.length, 'alert')}
				</Badge>
			</div>
		)}
	</DragOverlay>
);
