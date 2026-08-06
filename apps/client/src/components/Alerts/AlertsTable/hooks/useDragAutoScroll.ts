import { RefObject, useEffect, useRef } from 'react';

// How close to the scrollport's top/bottom edge (px) the pointer must be before
// auto-scroll kicks in, and the fastest scroll step (px per frame) at full proximity.
// 4px/frame (~240px/s at 60fps) — deliberate pace: sweeping a long list takes a
// moment, but the drag releases on exactly the intended row, no overshoot.
const EDGE_ZONE_PX = 56;
const MAX_STEP_PX = 4;

// Signed scroll step for the current pointer position: 0 outside the edge zones,
// scaling up to ±MAX_STEP_PX the deeper the pointer sits in a zone (or past the edge).
const edgeScrollStep = (pointerY: number, rect: DOMRect): number => {
	if (pointerY > rect.bottom - EDGE_ZONE_PX) {
		const proximity = Math.min(1, (pointerY - (rect.bottom - EDGE_ZONE_PX)) / EDGE_ZONE_PX);
		return Math.ceil(proximity * MAX_STEP_PX);
	}
	if (pointerY < rect.top + EDGE_ZONE_PX) {
		const proximity = Math.min(1, (rect.top + EDGE_ZONE_PX - pointerY) / EDGE_ZONE_PX);
		return -Math.ceil(proximity * MAX_STEP_PX);
	}
	return 0;
};

interface UseDragAutoScrollOptions {
	// True while a drag-selection is in progress (useDragSelection's isDragging).
	isDragging: boolean;
	// The virtualized list's scroll element (AlertsTable's parentRef).
	scrollElementRef: RefObject<HTMLDivElement>;
	// Called with the alert id of the row under the pointer after each scroll step —
	// scrolling under a stationary cursor doesn't re-fire mouseenter, so newly revealed
	// rows must be selected explicitly.
	onDragOverAlertId: (alertId: string) => void;
}

// Auto-scrolls the alerts list while a drag-selection is held near the scrollport's
// top/bottom edge, so a drag can cover more rows than fit on screen. Speed scales with
// edge proximity; rows scrolled under the pointer are reported via onDragOverAlertId.
export const useDragAutoScroll = ({ isDragging, scrollElementRef, onDragOverAlertId }: UseDragAutoScrollOptions) => {
	// Refs, not state: the rAF loop reads these every frame without re-rendering.
	const pointerRef = useRef<{ x: number; y: number } | null>(null);
	const onDragOverRef = useRef(onDragOverAlertId);
	useEffect(() => {
		onDragOverRef.current = onDragOverAlertId;
	}, [onDragOverAlertId]);

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			pointerRef.current = { x: e.clientX, y: e.clientY };
		};
		window.addEventListener('mousemove', handleMouseMove);

		let frame = 0;
		const tick = () => {
			frame = requestAnimationFrame(tick);
			const scrollEl = scrollElementRef.current;
			const pointer = pointerRef.current;
			if (!scrollEl || !pointer) return;

			const rect = scrollEl.getBoundingClientRect();
			// Only steer while the pointer is horizontally over the table — a drag
			// wandering into the sidebar shouldn't keep scrolling the list.
			if (pointer.x < rect.left || pointer.x > rect.right) return;

			const step = edgeScrollStep(pointer.y, rect);
			if (step === 0) return;

			const before = scrollEl.scrollTop;
			scrollEl.scrollTop = before + step;
			if (scrollEl.scrollTop === before) return;

			// Select the row now under the pointer. Clamp the probe point just inside the
			// scrollport so drags held past its edge still pick the outermost visible row.
			// The column header is position:sticky INSIDE this scrollport, pinned at its
			// top — clamp below it, or an upward drag would probe the header instead of
			// the row emerging underneath it.
			const stickyHeader = scrollEl.querySelector(':scope > div > .sticky');
			const probeTop = (stickyHeader?.getBoundingClientRect().bottom ?? rect.top) + 4;
			const probeY = Math.min(Math.max(pointer.y, probeTop), rect.bottom - 4);
			const hit = document.elementFromPoint(pointer.x, probeY)?.closest<HTMLElement>('[data-alert-id]');
			if (hit?.dataset.alertId) {
				onDragOverRef.current(hit.dataset.alertId);
			}
		};
		frame = requestAnimationFrame(tick);

		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			cancelAnimationFrame(frame);
			pointerRef.current = null;
		};
	}, [isDragging, scrollElementRef]);
};
