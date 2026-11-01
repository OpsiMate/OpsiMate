import { cn } from '@/lib/utils';

// A keystroke is a much smaller gesture than a drag, so the step is the width a keyboard
// user expects to travel per press; Shift is the coarse version of the same move.
const KEYBOARD_STEP = 16;
const KEYBOARD_STEP_COARSE = 64;

interface PanelResizeHandleProps {
	onPointerDown: (e: React.PointerEvent) => void;
	onDoubleClick: () => void;
	/** Current panel width, reported as `aria-valuenow` and stepped by the arrow keys. */
	value: number;
	minValue: number;
	maxValue: number;
	/** Attach to the drag handle's keyboard step. Must clamp to `[minValue, maxValue]`. */
	onSetValue: (next: number) => void;
	/** Which edge of the panel the strip sits on. A right-docked panel drags its left edge, a left-docked sidebar its right edge. */
	side?: 'left' | 'right';
	ariaLabel: string;
}

// The invisible grab strip on a docked panel's resize edge; highlights on hover while dragging.
// It is a focusable separator — the splitter pattern the table's column handles already use
// (SortableHeader) — so a keyboard user can reach the width too, not only a mouse one.
export const PanelResizeHandle = ({
	onPointerDown,
	onDoubleClick,
	value,
	minValue,
	maxValue,
	onSetValue,
	side = 'left',
	ariaLabel,
}: PanelResizeHandleProps) => (
	<div
		role="separator"
		tabIndex={0}
		aria-orientation="vertical"
		aria-label={ariaLabel}
		aria-valuemin={minValue}
		aria-valuemax={maxValue}
		aria-valuenow={value}
		title="Drag or press arrow keys to resize · double-click to reset"
		onPointerDown={onPointerDown}
		onDoubleClick={onDoubleClick}
		onKeyDown={(e) => {
			// ArrowRight always widens the panel and ArrowLeft narrows it, whichever edge the
			// handle sits on: they move `aria-valuenow`, not the pointer.
			if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
				e.preventDefault();
				const step = e.shiftKey ? KEYBOARD_STEP_COARSE : KEYBOARD_STEP;
				onSetValue(value + (e.key === 'ArrowRight' ? step : -step));
			} else if (e.key === 'Home') {
				e.preventDefault();
				onSetValue(minValue);
			} else if (e.key === 'End') {
				e.preventDefault();
				onSetValue(maxValue);
			}
		}}
		className={cn(
			'group absolute top-0 z-10 h-full w-1.5 cursor-col-resize flex items-stretch focus-visible:outline-none',
			side === 'right' && 'right-0 justify-end',
			side === 'left' && 'left-0'
		)}
	>
		{/* The bar the pointer shows on hover; focus gets it too, since a keyboard user has
		    no cursor to hover and needs to see which edge they are moving. */}
		<div className="w-0.5 h-full bg-transparent group-hover:bg-primary/60 group-active:bg-primary group-focus-visible:bg-primary group-focus-visible:w-1 transition-all" />
	</div>
);
