import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

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

// Safari in private mode and "block all cookies" throw on any storage access. A panel that
// cannot remember its width is still a usable panel, so a failure here is never fatal.
const readSavedWidth = (storageKey: string): number => {
	try {
		return Number(localStorage.getItem(storageKey));
	} catch {
		return NaN;
	}
};

const saveWidth = (storageKey: string, value: number): void => {
	try {
		localStorage.setItem(storageKey, String(value));
	} catch {
		// Nothing to undo: the width simply starts over at the default next session.
	}
};

const loadSavedWidth = (storageKey: string, defaultWidth: number, minWidth: number, maxWidth: number): number => {
	const saved = readSavedWidth(storageKey);
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

	// Letting go of the pointer is not the only way a drag ends: a cancelled touch never
	// fires pointerup, and the panel can unmount mid-drag. Both would otherwise leave the
	// window listeners attached and the body stuck with a col-resize cursor. Whatever width
	// the drag reached is kept, so a cancelled drag behaves like a released one.
	const stopResizing = useCallback(() => {
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', stopResizing);
		window.removeEventListener('pointercancel', stopResizing);
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
		saveWidth(storageKey, widthRef.current);
	}, [onPointerMove, storageKey]);

	useEffect(
		() => () => {
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', stopResizing);
			window.removeEventListener('pointercancel', stopResizing);
			document.body.style.userSelect = '';
			document.body.style.cursor = '';
		},
		[onPointerMove, stopResizing]
	);

	const startResizing = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			window.addEventListener('pointermove', onPointerMove);
			window.addEventListener('pointerup', stopResizing);
			window.addEventListener('pointercancel', stopResizing);
			document.body.style.userSelect = 'none';
			document.body.style.cursor = 'col-resize';
		},
		[onPointerMove, stopResizing]
	);

	const resetWidth = useCallback(() => {
		widthRef.current = defaultWidth;
		setWidth(defaultWidth);
		saveWidth(storageKey, defaultWidth);
	}, [defaultWidth, storageKey]);

	return { width, panelRef, startResizing, resetWidth };
};
