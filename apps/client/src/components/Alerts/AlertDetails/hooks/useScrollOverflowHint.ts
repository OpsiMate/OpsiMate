import { RefObject, useEffect, useState } from 'react';

// Whether a capped, scrollable block still has content below its fold — true while it
// overflows and is not scrolled to the bottom. Drives the fade that tells the reader
// "there is more": without it a capped block reads as if the text simply ended.
export const useScrollOverflowHint = (ref: RefObject<HTMLElement | null>, deps: unknown[] = []): boolean => {
	const [hasMoreBelow, setHasMoreBelow] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const update = () => {
			const overflowing = el.scrollHeight > el.clientHeight + 1;
			const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
			setHasMoreBelow(overflowing && !atBottom);
		};
		update();
		el.addEventListener('scroll', update, { passive: true });
		// Content and width changes (panel resize, fonts loading) move the fold.
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
		observer?.observe(el);
		return () => {
			el.removeEventListener('scroll', update);
			observer?.disconnect();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ref, ...deps]);

	return hasMoreBelow;
};
