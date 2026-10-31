import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useIsMobile } from '@/hooks/use-mobile';

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
let changeListener: (() => void) | undefined;
const addEventListener = vi.fn((eventName: string, listener: () => void) => {
	if (eventName === 'change') changeListener = listener;
});
const removeEventListener = vi.fn();
const matchMedia = vi.fn((query: string) => ({
	matches: window.innerWidth < 768,
	media: query,
	onchange: null,
	addListener: vi.fn(),
	removeListener: vi.fn(),
	addEventListener,
	removeEventListener,
	dispatchEvent: vi.fn(),
}));

const setWidth = (width: number) => {
	Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
};

beforeEach(() => {
	changeListener = undefined;
	addEventListener.mockClear();
	removeEventListener.mockClear();
	matchMedia.mockClear();
	setWidth(768);
	Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia });
});

afterEach(() => {
	if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
	else Reflect.deleteProperty(window, 'matchMedia');
});

describe('useIsMobile', () => {
	test('uses the 767px query and reports both sides of the breakpoint', () => {
		const desktop = renderHook(() => useIsMobile());
		expect(desktop.result.current).toBe(false);
		expect(matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
		desktop.unmount();

		setWidth(767);
		const mobile = renderHook(() => useIsMobile());
		expect(mobile.result.current).toBe(true);
	});

	test('updates when the media query change listener fires', () => {
		const { result } = renderHook(() => useIsMobile());
		setWidth(767);
		act(() => changeListener?.());
		expect(result.current).toBe(true);
		setWidth(768);
		act(() => changeListener?.());
		expect(result.current).toBe(false);
	});

	test('removes the change listener on unmount', () => {
		const { unmount } = renderHook(() => useIsMobile());
		const registeredListener = changeListener;
		unmount();
		expect(removeEventListener).toHaveBeenCalledWith('change', registeredListener);
	});
});
