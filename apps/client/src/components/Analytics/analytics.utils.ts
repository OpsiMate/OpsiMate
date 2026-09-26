import { describe, expect, it } from 'vitest';
import {
	deltaPercent,
	formatBucketTick,
	formatDurationMs,
	formatPercent,
} from '../components/Analytics/analytics.utils';

describe('analytics.utils', () => {
	describe('formatDurationMs', () => {
		it('returns "—" for null', () => {
			expect(formatDurationMs(null)).toBe('—');
		});

		it('returns "<1s" for durations below one second', () => {
			expect(formatDurationMs(0)).toBe('<1s');
			expect(formatDurationMs(500)).toBe('<1s');
			expect(formatDurationMs(999)).toBe('<1s');
		});

		it('formats seconds correctly (59s)', () => {
			expect(formatDurationMs(59000)).toBe('59s');
		});

		it('formats minutes and seconds correctly (1m 5s)', () => {
			expect(formatDurationMs(65000)).toBe('1m 5s');
		});

		it('formats days and hours correctly (2d 4h)', () => {
			expect(formatDurationMs((2 * 24 + 4) * 3600 * 1000)).toBe('2d 4h');
		});
	});

	describe('formatPercent', () => {
		it('returns "—" for null', () => {
			expect(formatPercent(null)).toBe('—');
		});

		it('formats a normal rate', () => {
			expect(formatPercent(0.25)).toBe('25%');
			expect(formatPercent(0.05)).toBe('5.0%');
		});
	});

	describe('deltaPercent', () => {
		it('returns null when previous is null or 0', () => {
			expect(deltaPercent(100, null)).toBeNull();
			expect(deltaPercent(100, 0)).toBeNull();
		});

		it('calculates a normal change', () => {
			expect(deltaPercent(150, 100)).toBe(0.5);
			expect(deltaPercent(80, 100)).toBe(-0.2);
		});
	});

	describe('formatBucketTick', () => {
		it('formats an hourly bucket', () => {
			expect(formatBucketTick('2023-01-01 14:00', 'hour')).toBe('14:00');
		});

		it('formats a midnight hourly tick', () => {
			const expected = new Date('2023-01-01T00:00').toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
			});
			expect(formatBucketTick('2023-01-01 00:00', 'hour')).toBe(expected);
		});

		it('formats a daily bucket', () => {
			const expected = new Date('2023-01-01T00:00').toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
			});
			expect(formatBucketTick('2023-01-01', 'day')).toBe(expected);
		});
	});
});