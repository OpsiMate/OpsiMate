import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useResizablePanelWidth } from '@/components/Alerts/AlertDetails/AlertDetailsPanel/useResizablePanelWidth';

// The gesture contract: the panel opens at 340px unless a saved width inside
// [280, 640] exists; a drag measures from the window's right edge when no panel
// element is rendered (panelRef.current is null in a hook test); the live width
// never touches localStorage; the chosen width persists exactly once, on
// pointerup; double-click resets to the default.

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
