interface PanelResizeHandleProps {
	onPointerDown: (e: React.PointerEvent) => void;
	onDoubleClick: () => void;
}

// The invisible grab strip on the panel's left edge; highlights on hover while dragging.
export const PanelResizeHandle = ({ onPointerDown, onDoubleClick }: PanelResizeHandleProps) => (
	<div
		role="separator"
		aria-orientation="vertical"
		aria-label="Resize alert details panel"
		title="Drag to resize · double-click to reset"
		onPointerDown={onPointerDown}
		onDoubleClick={onDoubleClick}
		className="group absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize flex items-stretch"
	>
		<div className="w-0.5 h-full bg-transparent group-hover:bg-primary/60 group-active:bg-primary transition-colors" />
	</div>
);
