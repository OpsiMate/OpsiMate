import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useResizablePanelWidth } from '@/components/shared/hooks/useResizablePanelWidth';

// The gesture contract: the panel opens at 340px unless a saved width inside
// [280, 640] exists; a drag measures from the window's right edge when no panel
// element is rendered (panelRef.current is null in a hook test); the live width
// never touches localStorage; the chosen width persists exactly once, when the drag
// ends (pointerup, or a pointercancel that never fires pointerup); unmounting releases a
// drag that is still in flight; storage that throws degrades to the default; and
// double-click resets to the default. The last block covers the second
// consumer - the left-docked filter sidebar, which drags the other way.

const STORAGE_KEY = 'opsimate-alert-details-panel-width';

const realInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');

const setInnerWidth = (value: number) => {
	Object.defineProperty(window, 'innerWidth', { value, writable: true, configurable: true });
};

const startDrag = (current: ReturnType<typeof useResizablePanelWidth>) => {
	const preventDefault = vi.fn();
	act(() => {
		current.startResizing({ preventDefault } as unknown as React.PointerEvent);
	});
	return preventDefault;
};

// jsdom may lack PointerEvent; a MouseEvent with a pointer* type carries clientX
// and triggers window listeners just the same.
const pointerMove = (clientX: number) => {
	act(() => {
		window.dispatchEvent(new MouseEvent('pointermove', { clientX }));
	});
};

const pointerUp = () => {
	act(() => {
		window.dispatchEvent(new MouseEvent('pointerup'));
	});
};

beforeEach(() => {
	localStorage.clear();
	document.body.style.userSelect = '';
	document.body.style.cursor = '';
	setInnerWidth(1000);
});

afterEach(() => {
	// Release any drag a test left active - the hook only removes its window
	// listeners on pointerup, so an unreleased drag would leak into later tests.
	pointerUp();
	localStorage.clear();
	document.body.style.userSelect = '';
	document.body.style.cursor = '';
	if (realInnerWidth) Object.defineProperty(window, 'innerWidth', realInnerWidth);
});

describe('useResizablePanelWidth - initial width', () => {
	test('defaults to 340 when nothing is stored', () => {
		const { result } = renderHook(() => useResizablePanelWidth());
		expect(result.current.width).toBe(340);
	});

	test('accepts a stored width inside the bounds', () => {
		localStorage.setItem(STORAGE_KEY, '500');
		const { result } = renderHook(() => useResizablePanelWidth());
		expect(result.current.width).toBe(500);
	});

	test.each([
		['100', 'below the 280px minimum'],
		['900', 'above the 640px maximum'],
		['abc', 'not a number'],
	])('falls back to 340 when the stored value is %s (%s)', (stored) => {
		localStorage.setItem(STORAGE_KEY, stored);
		const { result } = renderHook(() => useResizablePanelWidth());
		expect(result.current.width).toBe(340);
	});

	test.each(['280', '640'])('accepts the exact bound %spx', (stored) => {
		localStorage.setItem(STORAGE_KEY, stored);
		const { result } = renderHook(() => useResizablePanelWidth());
		expect(result.current.width).toBe(Number(stored));
	});
});

describe('useResizablePanelWidth - dragging', () => {
	test('startResizing prevents the default and locks selection and cursor', () => {
		const { result } = renderHook(() => useResizablePanelWidth());
		const preventDefault = startDrag(result.current);
		expect(preventDefault).toHaveBeenCalledTimes(1);
		expect(document.body.style.userSelect).toBe('none');
		expect(document.body.style.cursor).toBe('col-resize');
	});

	test('a pointermove sets the width to innerWidth - clientX', () => {
		const { result } = renderHook(() => useResizablePanelWidth());
		startDrag(result.current);
		pointerMove(500);
		expect(result.current.width).toBe(500);
	});

	test('the live width clamps to 640 on a far-left move and 280 on a far-right move', () => {
		const { result } = renderHook(() => useResizablePanelWidth());
		startDrag(result.current);
		pointerMove(-200);
		expect(result.current.width).toBe(640);
		pointerMove(900);
		expect(result.current.width).toBe(280);
	});

	test('nothing is written to localStorage while moving', () => {
		const { result } = renderHook(() => useResizablePanelWidth());
		startDrag(result.current);
		pointerMove(500);
		pointerMove(400);
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});
});

describe('useResizablePanelWidth - releasing', () => {
	test('pointerup persists the final width and restores the body styles', () => {
		const { result } = renderHook(() => useResizablePanelWidth());
		startDrag(result.current);
		pointerMove(500);
		pointerUp();
		expect(localStorage.getItem(STORAGE_KEY)).toBe('500');
		expect(document.body.style.userSelect).toBe('');
		expect(document.body.style.cursor).toBe('');
	});

	test('after pointerup the listeners are gone: further moves do not change the width', () => {
		const { result } = renderHook(() => useResizablePanelWidth());
		startDrag(result.current);
		pointerMove(500);
		pointerUp();
		pointerMove(700);
		expect(result.current.width).toBe(500);
	});
});

describe('useResizablePanelWidth - reset', () => {
	test('resetWidth restores 340 and persists it', () => {
		const { result } = renderHook(() => useResizablePanelWidth());
		startDrag(result.current);
		pointerMove(500);
		pointerUp();
		act(() => {
			result.current.resetWidth();
		});
		expect(result.current.width).toBe(340);
		expect(localStorage.getItem(STORAGE_KEY)).toBe('340');
	});
});

// The filter sidebar is the second consumer. It docks left, so the same drag reads the
// pointer from its left edge (x = 0 when a hook test renders no element), and it keeps its
// own bounds and storage key - widening the filters must never resize the details panel.
const SIDEBAR_STORAGE_KEY = 'opsimate-alerts-filter-sidebar-width';
const SIDEBAR_OPTIONS = {
	dock: 'left',
	defaultWidth: 192,
	minWidth: 192,
	maxWidth: 480,
	storageKey: SIDEBAR_STORAGE_KEY,
} as const;

const renderSidebar = () => renderHook(() => useResizablePanelWidth(SIDEBAR_OPTIONS));

describe('useResizablePanelWidth - left-docked sidebar', () => {
	test('opens at 192 and ignores a stored details-panel width', () => {
		localStorage.setItem(STORAGE_KEY, '600');
		const { result } = renderSidebar();
		expect(result.current.width).toBe(192);
	});

	test('reads back its own stored width, and falls back outside [192, 480]', () => {
		localStorage.setItem(SIDEBAR_STORAGE_KEY, '300');
		expect(renderSidebar().result.current.width).toBe(300);
		localStorage.setItem(SIDEBAR_STORAGE_KEY, '900');
		expect(renderSidebar().result.current.width).toBe(192);
	});

	test('a pointermove sets the width to clientX', () => {
		const { result } = renderSidebar();
		startDrag(result.current);
		pointerMove(300);
		expect(result.current.width).toBe(300);
	});

	test('the live width clamps to 480 on a far-right move and 192 on a far-left one', () => {
		const { result } = renderSidebar();
		startDrag(result.current);
		pointerMove(1200);
		expect(result.current.width).toBe(480);
		pointerMove(-50);
		expect(result.current.width).toBe(192);
	});

	test('pointerup persists under the sidebar key only', () => {
		const { result } = renderSidebar();
		startDrag(result.current);
		pointerMove(300);
		pointerUp();
		expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('300');
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	test('resetWidth restores 192 and persists it', () => {
		const { result } = renderSidebar();
		startDrag(result.current);
		pointerMove(300);
		pointerUp();
		act(() => {
			result.current.resetWidth();
		});
		expect(result.current.width).toBe(192);
		expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('192');
	});
});

describe('useResizablePanelWidth - a drag that never gets released', () => {
	test('pointercancel ends the drag, unlocks the body and keeps the width it reached', () => {
		const { result } = renderHook(() => useResizablePanelWidth());
		startDrag(result.current);
		pointerMove(500);
		act(() => {
			window.dispatchEvent(new MouseEvent('pointercancel'));
		});
		expect(document.body.style.userSelect).toBe('');
		expect(document.body.style.cursor).toBe('');
		pointerMove(700);
		expect(result.current.width).toBe(500);
		expect(localStorage.getItem(STORAGE_KEY)).toBe('500');
	});

	test('unmounting mid-drag unlocks the body and drops the listeners', () => {
		const { result, unmount } = renderHook(() => useResizablePanelWidth());
		startDrag(result.current);
		pointerMove(500);
		unmount();
		expect(document.body.style.userSelect).toBe('');
		expect(document.body.style.cursor).toBe('');
		// The handler must be gone: a stray move after unmount would otherwise keep
		// calling setState on a dead component.
		pointerMove(700);
		expect(result.current.width).toBe(500);
	});
});

describe('useResizablePanelWidth - storage that refuses', () => {
	// Safari in private mode and "block all cookies" throw on any storage access, which
	// would take the whole Alerts page down with it.
	test('a getItem that throws opens at the default width', () => {
		const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		try {
			const { result } = renderHook(() => useResizablePanelWidth());
			expect(result.current.width).toBe(340);
		} finally {
			blocked.mockRestore();
		}
	});

	test('a setItem that throws still finishes the drag', () => {
		const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		try {
			const { result } = renderHook(() => useResizablePanelWidth());
			startDrag(result.current);
			pointerMove(500);
			expect(() => pointerUp()).not.toThrow();
			expect(result.current.width).toBe(500);
		} finally {
			blocked.mockRestore();
		}
	});
});
