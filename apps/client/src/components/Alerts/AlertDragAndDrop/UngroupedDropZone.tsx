import { cn } from '@/lib/utils';
import { useDroppable } from '@dnd-kit/core';
import { FolderMinus } from 'lucide-react';

interface UngroupedDropZoneProps {
	// This table's "ungrouped" droppable id (see dropId.ungrouped) — each table has its own.
	id: string;
	// The table background under the rows is a drop target too; light the band up for it.
	areaIsOver: boolean;
}

// Shown above the rows while incident members are being dragged: drop them here (or on
// the table's empty space) to take them out of their incident.
export const UngroupedDropZone = ({ id, areaIsOver }: UngroupedDropZoneProps) => {
	const { setNodeRef, isOver } = useDroppable({ id });
	const active = isOver || areaIsOver;
	return (
		<div
			ref={setNodeRef}
			data-drop-target={id}
			className={cn(
				'flex shrink-0 items-center justify-center gap-2 border-b border-dashed px-3 py-2 text-sm transition-colors',
				active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground'
			)}
		>
			<FolderMinus className="h-4 w-4" />
			Drop here to take the alerts out of their incident
		</div>
	);
};
