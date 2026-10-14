import { cn } from '@/lib/utils';

interface PanelResizeHandleProps {
	onPointerDown: (e: React.PointerEvent) => void;
	onDoubleClick: () => void;
	/** Which edge of the panel the strip sits on. A right-docked panel drags its left edge, a left-docked sidebar its right edge. */
	side?: 'left' | 'right';
	ariaLabel: string;
}

// The invisible grab strip on a docked panel's resize edge; highlights on hover while dragging.
export const PanelResizeHandle = ({
	onPointerDown,
	onDoubleClick,
	side = 'left',
	ariaLabel,
}: PanelResizeHandleProps) => (
	<div
		role="separator"
		aria-orientation="vertical"
		aria-label={ariaLabel}
		title="Drag to resize · double-click to reset"
		onPointerDown={onPointerDown}
		onDoubleClick={onDoubleClick}
		className={cn(
			'group absolute top-0 z-10 h-full w-1.5 cursor-col-resize flex items-stretch',
			side === 'right' && 'right-0 justify-end',
			side === 'left' && 'left-0'
		)}
	>
		<div className="w-0.5 h-full bg-transparent group-hover:bg-primary/60 group-active:bg-primary transition-colors" />
	</div>
);
