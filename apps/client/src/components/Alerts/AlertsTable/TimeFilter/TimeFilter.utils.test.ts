import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createEmptyTimeRange, formatTimeRange, isTimeRangeEmpty, resolveTimeRange } from './TimeFilter.utils';

describe('TimeFilter.utils', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	test('resolveTimeRange materializes rolling preset windows from now', () => {
		const { from, to } = resolveTimeRange({ from: null, to: null, preset: 'last1h' });
		expect(to?.toISOString()).toBe('2024-06-15T12:00:00.000Z');
		expect(from?.toISOString()).toBe('2024-06-15T11:00:00.000Z');
	});

	test('resolveTimeRange passes custom from/to through', () => {
		const from = new Date('2024-01-01T00:00:00.000Z');
		const to = new Date('2024-01-02T00:00:00.000Z');
		const result = resolveTimeRange({ from, to, preset: 'custom' });
		expect(result.from).toBe(from);
		expect(result.to).toBe(to);
	});

	test('formatTimeRange covers empty, preset, range, from-only, to-only', () => {
		expect(formatTimeRange(createEmptyTimeRange())).toBe('All time');
		expect(formatTimeRange({ from: null, to: null, preset: 'last1h' })).toBe('Last 1 hour');
		const from = new Date(2024, 5, 15, 10, 0);
		const to = new Date(2024, 5, 15, 12, 0);
		expect(formatTimeRange({ from, to, preset: 'custom' })).toMatch(/06\/15 10:00 - 06\/15 12:00/);
		expect(formatTimeRange({ from, to: null, preset: 'custom' })).toMatch(/^From /);
		expect(formatTimeRange({ from: null, to, preset: 'custom' })).toMatch(/^Until /);
	});

	test('createEmptyTimeRange and isTimeRangeEmpty', () => {
		const empty = createEmptyTimeRange();
		expect(isTimeRangeEmpty(empty)).toBe(true);
		expect(isTimeRangeEmpty({ from: new Date(), to: null, preset: null })).toBe(false);
	});
});
