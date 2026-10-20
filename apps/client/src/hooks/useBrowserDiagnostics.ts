import { BrowserDiagnostics, collectBrowserDiagnostics } from '@/lib/browserDiagnostics';
import { useEffect, useState } from 'react';

// Media queries whose answer can change while the page is open: a Contrast theme
// toggled, a laptop docked to a mouse, dark mode flipping with the clock.
const WATCHED_QUERIES = [
	'(hover: hover)',
	'(pointer: fine)',
	'(forced-colors: active)',
	'(prefers-color-scheme: dark)',
	'(prefers-reduced-motion: reduce)',
	'(prefers-contrast: more)',
];

// The diagnostics as of NOW: collected once on mount and again whenever the window is
// resized or a watched media query flips, so the printed report never describes a state
// the browser has since left. (Collected in an effect, not during render, so a render
// for an unrelated reason does not re-run every probe.)
export const useBrowserDiagnostics = (): BrowserDiagnostics => {
	const [diagnostics, setDiagnostics] = useState<BrowserDiagnostics>(() => collectBrowserDiagnostics());

	useEffect(() => {
		const refresh = () => setDiagnostics(collectBrowserDiagnostics());
		window.addEventListener('resize', refresh);
		const watched: MediaQueryList[] = [];
		if (typeof window.matchMedia === 'function') {
			for (const query of WATCHED_QUERIES) {
				try {
					const list = window.matchMedia(query);
					// Older browsers only have the deprecated addListener.
					if (typeof list.addEventListener === 'function') list.addEventListener('change', refresh);
					else list.addListener?.(refresh);
					watched.push(list);
				} catch {
					// An unsupported query cannot change; nothing to watch.
				}
			}
		}
		return () => {
			window.removeEventListener('resize', refresh);
			for (const list of watched) {
				if (typeof list.removeEventListener === 'function') list.removeEventListener('change', refresh);
				else list.removeListener?.(refresh);
			}
		};
	}, []);

	return diagnostics;
};
