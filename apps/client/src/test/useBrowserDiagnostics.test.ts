import { useBrowserDiagnostics } from '@/hooks/useBrowserDiagnostics';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

// The hook watches the media queries whose answer can change while the page is open. The
// contract: one 'change' listener per query, all removed on unmount, and the deprecated
// addListener API used when that is all the browser has.
describe('useBrowserDiagnostics', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('subscribes to every watched media query and unsubscribes on unmount', () => {
		const spy = vi.spyOn(window, 'matchMedia');
		const { unmount } = renderHook(() => useBrowserDiagnostics());

		// First render probes each query once, the effect subscribes to each once.
		const lists = spy.mock.results.map((r) => r.value as MediaQueryList);
		const subscribed = lists.filter((l) => (l.addEventListener as ReturnType<typeof vi.fn>).mock.calls.length > 0);
		expect(subscribed).toHaveLength(6);
		for (const list of subscribed) {
			expect(list.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
			expect(list.removeEventListener).not.toHaveBeenCalled();
		}

		unmount();
		for (const list of subscribed) {
			const added = (list.addEventListener as ReturnType<typeof vi.fn>).mock.calls[0][1];
			expect(list.removeEventListener).toHaveBeenCalledWith('change', added);
		}
	});

	test('falls back to addListener/removeListener on browsers without addEventListener', () => {
		const addListener = vi.fn();
		const removeListener = vi.fn();
		vi.spyOn(window, 'matchMedia').mockImplementation(
			(query) => ({ matches: false, media: query, addListener, removeListener }) as unknown as MediaQueryList
		);
		const { unmount } = renderHook(() => useBrowserDiagnostics());
		expect(addListener).toHaveBeenCalledTimes(6);
		unmount();
		expect(removeListener).toHaveBeenCalledTimes(6);
		expect(removeListener.mock.calls.map((c) => c[0])).toEqual(addListener.mock.calls.map((c) => c[0]));
	});
});
