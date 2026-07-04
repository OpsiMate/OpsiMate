import { RefObject, useCallback, useRef, useState } from 'react';

const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 280;
const MAX_WIDTH = 640;
const WIDTH_STORAGE_KEY = 'opsimate-alert-details-panel-width';

const loadSavedWidth = (): number => {
	const saved = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
	if (Number.isFinite(saved) && saved >= MIN_WIDTH && saved <= MAX_WIDTH) return saved;
	return DEFAULT_WIDTH;
};

interface ResizablePanelWidth {
	width: number;
	panelRef: RefObject<HTMLDivElement>;
	/** Attach to the drag handle's onPointerDown. */
	startResizing: (e: React.PointerEvent) => void;
	/** Restore the default width (double-click on the handle). */
	resetWidth: () => void;
}

// Drag-resizable width for a right-docked panel: dragging the panel's left edge grows it
// leftward. Same pointer-drag idiom as VerticalSplit; the chosen width persists across
// sessions in localStorage.
export const useResizablePanelWidth = (): ResizablePanelWidth => {
	const [width, setWidth] = useState(loadSavedWidth);
	const widthRef = useRef(width);
	const panelRef = useRef<HTMLDivElement>(null);

	const onPointerMove = useCallback((e: PointerEvent) => {
		const right = panelRef.current?.getBoundingClientRect().right ?? window.innerWidth;
		const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, right - e.clientX));
		widthRef.current = next;
		setWidth(next);
	}, []);

	const stopResizing = useCallback(() => {
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', stopResizing);
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
		localStorage.setItem(WIDTH_STORAGE_KEY, String(widthRef.current));
	}, [onPointerMove]);

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
		widthRef.current = DEFAULT_WIDTH;
		setWidth(DEFAULT_WIDTH);
		localStorage.setItem(WIDTH_STORAGE_KEY, String(DEFAULT_WIDTH));
	}, []);

	return { width, panelRef, startResizing, resetWidth };
};
