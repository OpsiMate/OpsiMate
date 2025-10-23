import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ArrowUp } from 'lucide-react';

const SCROLL_DURATION = 480; // ms

function easeOutCubic(t: number) {
	return 1 - Math.pow(1 - t, 3);
}

function animateScroll(element: HTMLElement | Window, to = 0, duration = SCROLL_DURATION) {
	const isWindow = element === window;
	const start = isWindow ? window.scrollY : (element as HTMLElement).scrollTop;
	const change = start - to;
	if (change <= 0) return;
	const startTime = performance.now();
	function step(now: number) {
		const elapsed = Math.min(1, (now - startTime) / duration);
		const t = easeOutCubic(elapsed);
		const current = Math.round(start - change * t);
		if (isWindow) window.scrollTo(0, current);
		else (element as HTMLElement).scrollTop = current;
		if (elapsed < 1) requestAnimationFrame(step);
	}
	requestAnimationFrame(step);
}

function tryNativeSmoothScroll(el: HTMLElement | Window) {
	try {
		el.scrollTo({ top: 0, behavior: 'smooth' as ScrollBehavior });
		return true;
	} catch {
		return false;
	}
}

// A slightly optimization in find function
function findScrollableElements(): Array<HTMLElement | Window> {
	const results: Array<HTMLElement | Window> = [];
	if (typeof document === 'undefined') return [window];

	results.push(window);

	const all = Array.from(document.querySelectorAll<HTMLElement>('*'));
	for (const el of all) {
		const style = window.getComputedStyle(el);
		const overflowY = style.overflowY;
		if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
			results.push(el);
		}
	}
	return Array.from(new Set(results));
}

function scrollAllToTop() {
	const containers = findScrollableElements();
	for (const c of containers) {
		const pos = c === window ? c.scrollY : (c as HTMLElement).scrollTop;
		if (pos <= 0) continue;

		const usedNative = tryNativeSmoothScroll(c);
		if (!usedNative) animateScroll(c);
	}
}

const ScrollToTopButton: React.FC<{ right?: string; bottom?: string }> = ({ right = '22px', bottom = '22px' }) => {
	const [isVisible, setIsVisible] = useState(false);
	// Use a ref to keep track of the main scroll container
	const scrollContainerRef = useRef<HTMLElement | Window | null>(null);

	useEffect(() => {
		// Find the most likely primary scroll container on mount.
		// This could be a specific element or the window itself.
		const primaryContainer = document.querySelector<HTMLElement>('main') || document.body.parentElement || window;
		scrollContainerRef.current = primaryContainer;

		const handleScroll = () => {
			if (!scrollContainerRef.current) return;

			const container = scrollContainerRef.current;
			// Check scroll position for both window and HTML elements
			const scrollTop = (container as Window).scrollY ?? (container as HTMLElement).scrollTop;

			setIsVisible(scrollTop > 100);
		};

		// Initial check
		handleScroll();

		const container = scrollContainerRef.current;
		if (container) {
			container.addEventListener('scroll', handleScroll, { passive: true });
		}

		return () => {
			if (container) {
				container.removeEventListener('scroll', handleScroll);
			}
		};
	}, []); // Empty dependency array ensures this runs only once on mount

	if (typeof document === 'undefined' || !isVisible) {
		return null;
	}

	const button = (
		<button
			aria-label="Scroll to top"
			title="Scroll to top"
			onClick={e => {
				e.preventDefault();
				scrollAllToTop();
			}}
			style={{
				right,
				bottom,
				WebkitTapHighlightColor: 'transparent',
			}}
			className="fixed z-[999999] p-3 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 transition-all duration-200 transform hover:scale-105 active:scale-95 bg-slate-800/80 text-white"
		>
			<ArrowUp size={18} />
		</button>
	);

	return ReactDOM.createPortal(button, document.body);
};

export default ScrollToTopButton;
