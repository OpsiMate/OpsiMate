import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { useExpandRows } from './useExpandRows';

const STORAGE_KEY = 'opsimate-alerts-expand-rows';

beforeEach(() => localStorage.clear());

describe('useExpandRows', () => {
	test('starts collapsed when nothing has been stored', () => {
		const { result } = renderHook(() => useExpandRows());

		expect(result.current.expandRows).toBe(false);
	});

	test('starts expanded only when storage contains the string "true"', () => {
		for (const stored of ['false', '', 'null', '1', 'TRUE']) {
			localStorage.setItem(STORAGE_KEY, stored);
			const { result } = renderHook(() => useExpandRows());

			expect(result.current.expandRows).toBe(false);
		});

		localStorage.setItem(STORAGE_KEY, 'true');
		const { result } = renderHook(() => useExpandRows());

		expect(result.current.expandRows).toBe(true);
	});

	test('toggling flips the value and persists the choice', () => {
		const { result } = renderHook(() => useExpandRows());

		act(() => result.current.toggleExpandRows());
		expect(result.current.expandRows).toBe(true);
		expect(localStorage.getItem(STORAGE_KEY)).toBe('true');

		act(() => result.current.toggleExpandRows());
		expect(result.current.expandRows).toBe(false);
		expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
	});

	test('preserves the value across a remount', () => {
		const firstMount = renderHook(() => useExpandRows());

		act(() => firstMount.result.current.toggleExpandRows());
		firstMount.unmount();

		const secondMount = renderHook(() => useExpandRows());

		expect(secondMount.result.current.expandRows).toBe(true);
	});
});
