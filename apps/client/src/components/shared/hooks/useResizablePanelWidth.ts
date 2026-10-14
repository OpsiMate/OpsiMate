import { RefObject, useCallback, useRef, useState } from 'react';

// Two panels drag to a remembered width today: the right-docked alert details panel and
// the left-docked filter sidebar. The defaults below are the details panel's shape, so its
// call site stays a bare useResizablePanelWidth().
const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 280;
const MAX_WIDTH = 640;
const WIDTH_STORAGE_KEY = 'opsimate-alert-details-panel-width';

interface ResizablePanelWidthOptions {
	/**
	 * Which side the panel docks to, which decides which of its edges carries the handle:
	 * a right-docked panel drags from its left edge, a left-docked one from its right
	 * edge, so the pointer distance is measured the other way round.
	 */
	dock?: 'left' | 'right';
	defaultWidth?: number;
	minWidth?: number;
	maxWidth?: number;
	storageKey?: string;
}

interface ResizablePanelWidth {
	width: number;
	panelRef: RefObject<HTMLDivElement>;
	/** Attach to the drag handle's onPointerDown. */
	startResizing: (e: React.PointerEvent) => void;
	/** Restore the default width (double-click on the handle). */
	resetWidth: () => void;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const loadSavedWidth = (storageKey: string, defaultWidth: number, minWidth: number, maxWidth: number): number => {
	const saved = Number(localStorage.getItem(storageKey));
	if (Number.isFinite(saved) && saved >= minWidth && saved <= maxWidth) return saved;
	return defaultWidth;
};

// Drag-resizable width for a docked panel. Same pointer-drag idiom as VerticalSplit; the
// chosen width persists across sessions in localStorage.
export const useResizablePanelWidth = ({
	dock = 'right',
	defaultWidth = DEFAULT_WIDTH,
	minWidth = MIN_WIDTH,
	maxWidth = MAX_WIDTH,
	storageKey = WIDTH_STORAGE_KEY,
}: ResizablePanelWidthOptions = {}): ResizablePanelWidth => {
	const [width, setWidth] = useState(() => loadSavedWidth(storageKey, defaultWidth, minWidth, maxWidth));
	const widthRef = useRef(width);
	const panelRef = useRef<HTMLDivElement>(null);

	const onPointerMove = useCallback(
		(e: PointerEvent) => {
			// The panel's own edge is the measuring stick. Hook tests render no panel
			// element, so the viewport stands in for whichever edge is missing there.
			const rect = panelRef.current?.getBoundingClientRect();
			const dragged =
				dock === 'right' ? (rect?.right ?? window.innerWidth) - e.clientX : e.clientX - (rect?.left ?? 0);
			const next = clamp(dragged, minWidth, maxWidth);
			widthRef.current = next;
			setWidth(next);
		},
		[dock, minWidth, maxWidth]
	);

	const stopResizing = useCallback(() => {
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', stopResizing);
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
		localStorage.setItem(storageKey, String(widthRef.current));
	}, [onPointerMove, storageKey]);

	const startResizing = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			window.addEventListener('pointermove', onPointerMove);
			window.addEventListener('pointerup', stopResizing);
			document.body.style.userSelect = 'none';
			document.body.style.cursor = 'col-resize';
		},
		[onPointerMove, stopResizing]
	);

	const resetWidth = useCallback(() => {
		widthRef.current = defaultWidth;
		setWidth(defaultWidth);
		localStorage.setItem(storageKey, String(defaultWidth));
	}, [defaultWidth, storageKey]);

	return { width, panelRef, startResizing, resetWidth };
};
