import { useCallback, useEffect, useRef, useState } from 'react';

// A column can't be dragged wider than this; past it the value is almost certainly a
// slip of the hand, and one absurd column forces the whole table into horizontal scroll.
// Exported for the handle's aria-valuemax/min.
export const MAX_MANUAL_WIDTH_PX = 800;
// Deliberately far below COLUMN_MIN_WIDTHS: those are the floors for AUTOMATIC layout
// (what a column gets when nobody asked), while a drag is the user explicitly trading
// content for space — cells truncate with ellipsis, so a very narrow column is a valid
// choice. 50px keeps the header handle grabbable and a few characters visible.
export const MIN_MANUAL_WIDTH_PX = 50;

// Arrow-key resize step for keyboard users.
const KEYBOARD_STEP_PX = 10;

export interface UseColumnResizeOptions {
	// The saved manual widths (dashboard state). Never mutated here.
	columnWidths: Record<string, number>;
	// Commit: called ONCE per gesture on mouseup — not per mousemove. Live feedback runs
	// through this hook's local state instead, because the dashboard state lives at the
	// page level and updating it 60x/second re-renders every visible row per frame.
	onColumnWidthsChange?: (widths: Record<string, number>) => void;
}

export interface UseColumnResizeResult {
	// Width of the in-flight drag, overlaid on top of the saved widths while it lasts.
	liveWidths: Record<string, number>;
	// The column being dragged, so headers can pin their hover affordance.
	resizingColumn: string | null;
	// mousedown on a header's resize handle. Reads the header cell's rendered width as
	// the drag origin, so the gesture starts from whatever the column measures right
	// now — auto-sized, class-sized or already manual.
	startResize: (column: string, event: React.MouseEvent) => void;
	// Double-click on the handle: back to automatic sizing for that column.
	resetColumn: (column: string) => void;
	// Keyboard resize: one arrow press adjusts the column by a fixed step and commits
	// immediately (there's no gesture to batch). Reads the header cell's rendered width
	// as the base, same as startResize.
	nudgeColumn: (column: string, direction: -1 | 1, event: React.KeyboardEvent) => void;
}

const clampWidth = (width: number): number =>
	Math.round(Math.min(Math.max(width, MIN_MANUAL_WIDTH_PX), MAX_MANUAL_WIDTH_PX));

export const useColumnResize = ({
	columnWidths,
	onColumnWidthsChange,
}: UseColumnResizeOptions): UseColumnResizeResult => {
	const [liveWidths, setLiveWidths] = useState<Record<string, number>>({});
	const [resizingColumn, setResizingColumn] = useState<string | null>(null);
	// The gesture's fixed reference points; refs so the move handler never goes stale.
	const dragRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);
	const latestWidthsRef = useRef(columnWidths);
	latestWidthsRef.current = columnWidths;
	const onChangeRef = useRef(onColumnWidthsChange);
	onChangeRef.current = onColumnWidthsChange;

	const startResize = useCallback((column: string, event: React.MouseEvent) => {
		// The handle lives inside the sortable header cell: without these, releasing the
		// drag registers as a header click and sorts the table by the resized column.
		event.preventDefault();
		event.stopPropagation();
		const headerCell = (event.target as HTMLElement).closest('th');
		if (!headerCell) {
			return;
		}
		dragRef.current = {
			column,
			startX: event.clientX,
			startWidth: headerCell.getBoundingClientRect().width,
		};
		setResizingColumn(column);
		setLiveWidths({ [column]: clampWidth(headerCell.getBoundingClientRect().width) });
	}, []);

	useEffect(() => {
		if (!resizingColumn) {
			return;
		}
		const handleMove = (event: MouseEvent) => {
			const drag = dragRef.current;
			if (!drag) {
				return;
			}
			setLiveWidths({ [drag.column]: clampWidth(drag.startWidth + event.clientX - drag.startX) });
		};
		const handleUp = (event: MouseEvent) => {
			const drag = dragRef.current;
			dragRef.current = null;
			setResizingColumn(null);
			setLiveWidths({});
			if (drag) {
				const width = clampWidth(drag.startWidth + event.clientX - drag.startX);
				onChangeRef.current?.({ ...latestWidthsRef.current, [drag.column]: width });
			}
		};
		document.addEventListener('mousemove', handleMove);
		document.addEventListener('mouseup', handleUp);
		// Column-resize cursor everywhere for the gesture's duration — the pointer
		// outruns the handle on any fast drag.
		const previousCursor = document.body.style.cursor;
		const previousUserSelect = document.body.style.userSelect;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		return () => {
			document.removeEventListener('mousemove', handleMove);
			document.removeEventListener('mouseup', handleUp);
			document.body.style.cursor = previousCursor;
			document.body.style.userSelect = previousUserSelect;
		};
	}, [resizingColumn]);

	const nudgeColumn = useCallback((column: string, direction: -1 | 1, event: React.KeyboardEvent) => {
		const headerCell = (event.target as HTMLElement).closest('th');
		if (!headerCell) {
			return;
		}
		const width = clampWidth(headerCell.getBoundingClientRect().width + direction * KEYBOARD_STEP_PX);
		onChangeRef.current?.({ ...latestWidthsRef.current, [column]: width });
	}, []);

	const resetColumn = useCallback((column: string) => {
		if (!(column in latestWidthsRef.current)) {
			return;
		}
		const next = { ...latestWidthsRef.current };
		delete next[column];
		onChangeRef.current?.(next);
	}, []);

	return { liveWidths, resizingColumn, startResize, resetColumn, nudgeColumn };
};
