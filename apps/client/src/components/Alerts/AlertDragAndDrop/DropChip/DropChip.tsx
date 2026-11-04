import { cn } from '@/lib/utils';
import { useDroppable } from '@dnd-kit/core';

interface DropChipProps {
	id: string;
	icon: React.ReactNode;
	label: string;
	hint?: string;
	destructive?: boolean;
}

// One drop target in the IncidentDropTray.
export const DropChip = ({ id, icon, label, hint, destructive = false }: DropChipProps) => {
	const { setNodeRef, isOver } = useDroppable({ id });
	return (
		<div
			ref={setNodeRef}
			data-drop-target={id}
			className={cn(
				'flex max-w-64 items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors',
				isOver
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-dashed border-border bg-muted/40',
				destructive && !isOver && 'text-destructive'
			)}
		>
			{icon}
			<span className="truncate">{label}</span>
			{hint && (
				<span className={cn('shrink-0 text-xs', isOver ? 'opacity-80' : 'text-muted-foreground')}>{hint}</span>
			)}
		</div>
	);
};
