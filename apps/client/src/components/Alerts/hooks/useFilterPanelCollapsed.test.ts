import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { useFilterPanelCollapsed } from './useFilterPanelCollapsed';

const STORAGE_KEY = 'opsimate-alerts-filter-panel-collapsed';

afterEach(() => localStorage.clear());

describe('useFilterPanelCollapsed', () => {
	test('starts collapsed when nothing has been stored', () => {
		const { result } = renderHook(() => useFilterPanelCollapsed());
		expect(result.current.filterPanelCollapsed).toBe(true);
	});

	test('a stored "false" reopens the panel on the next visit', () => {
		localStorage.setItem(STORAGE_KEY, 'false');
		const { result } = renderHook(() => useFilterPanelCollapsed());
		expect(result.current.filterPanelCollapsed).toBe(false);
	});

	test('only an explicit "false" expands — corrupt values collapse', () => {
		for (const stored of ['', 'null', '0', 'nope', '{']) {
			localStorage.setItem(STORAGE_KEY, stored);
			const { result } = renderHook(() => useFilterPanelCollapsed());
			expect(result.current.filterPanelCollapsed).toBe(true);
		}
	});

	test('toggling persists the choice', () => {
		const { result } = renderHook(() => useFilterPanelCollapsed());

		act(() => result.current.toggleFilterPanelCollapsed());
		expect(result.current.filterPanelCollapsed).toBe(false);
		expect(localStorage.getItem(STORAGE_KEY)).toBe('false');

		act(() => result.current.toggleFilterPanelCollapsed());
		expect(result.current.filterPanelCollapsed).toBe(true);
		expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
	});

	test('leaves storage untouched until the user actually toggles', () => {
		renderHook(() => useFilterPanelCollapsed());
		// "never chose" stays distinguishable from "chose collapsed", so the default
		// remains changeable for users who have only ever seen it.
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});
});
