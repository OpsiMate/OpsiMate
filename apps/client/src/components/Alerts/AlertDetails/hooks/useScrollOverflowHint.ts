import { RefObject, useEffect, useState } from 'react';

export interface ScrollOverflowState {
	// The content is taller than the box.
	overflowing: boolean;
	// Overflowing and not scrolled to the bottom: there is text below the fold.
	hasMoreBelow: boolean;
}

const NOT_OVERFLOWING: ScrollOverflowState = { overflowing: false, hasMoreBelow: false };

// Whether a capped, scrollable block overflows, and whether content still sits below its
// fold. Drives the fade that tells the reader "there is more" (without it a capped block
// reads as if the text simply ended) and lets a block keep a floor height only when it
// actually has more to show.
export const useScrollOverflowHint = (
	ref: RefObject<HTMLElement | null>,
	deps: unknown[] = []
): ScrollOverflowState => {
	const [state, setState] = useState<ScrollOverflowState>(NOT_OVERFLOWING);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const update = () => {
			const overflowing = el.scrollHeight > el.clientHeight + 1;
			const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
			setState((prev) =>
				prev.overflowing === overflowing && prev.hasMoreBelow === (overflowing && !atBottom)
					? prev
					: { overflowing, hasMoreBelow: overflowing && !atBottom }
			);
		};
		update();
		el.addEventListener('scroll', update, { passive: true });
		// Content and width changes (panel resize, fonts loading) move the fold. The box
		// itself is capped, so a reflow inside it only shows on its children — observe those too.
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
		observer?.observe(el);
		Array.from(el.children).forEach((child) => observer?.observe(child));
		return () => {
			el.removeEventListener('scroll', update);
			observer?.disconnect();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ref, ...deps]);

	return state;
};
