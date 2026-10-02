import { describe, expect, test } from 'vitest';
import {
	deltaPercent,
	formatBucketTick,
	formatDurationMs,
	formatPercent,
} from '@/components/Analytics/analytics.utils';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe('formatDurationMs', () => {
	test('returns an em dash for null', () => {
		expect(formatDurationMs(null)).toBe('—');
	});

	test('shows <1s below one second', () => {
		expect(formatDurationMs(0)).toBe('<1s');
		expect(formatDurationMs(999)).toBe('<1s');
	});

	test('shows whole seconds under a minute', () => {
		expect(formatDurationMs(1000)).toBe('1s');
		expect(formatDurationMs(59 * SECOND)).toBe('59s');
	});

	test('rounds 59.5s up to 1m (no dangling seconds)', () => {
		expect(formatDurationMs(59.5 * SECOND)).toBe('1m');
	});

	test('shows minutes and seconds', () => {
		expect(formatDurationMs(MINUTE + 5 * SECOND)).toBe('1m 5s');
	});

	test('drops the seconds part when it is zero', () => {
		expect(formatDurationMs(MINUTE)).toBe('1m');
	});

	test('shows hours and minutes', () => {
		expect(formatDurationMs(2 * HOUR + 14 * MINUTE)).toBe('2h 14m');
		expect(formatDurationMs(HOUR)).toBe('1h');
	});

	test('stays in hours up to 47h, switches to days at 48h', () => {
		expect(formatDurationMs(47 * HOUR)).toBe('47h');
		expect(formatDurationMs(48 * HOUR)).toBe('2d');
	});

	test('shows days and hours', () => {
		expect(formatDurationMs(52 * HOUR)).toBe('2d 4h');
	});
});

describe('formatPercent', () => {
	test('returns an em dash for null', () => {
		expect(formatPercent(null)).toBe('—');
	});

	test('formats a normal rate with no decimals', () => {
		expect(formatPercent(0.5)).toBe('50%');
		expect(formatPercent(1)).toBe('100%');
	});

	test('keeps one decimal for small rates', () => {
		expect(formatPercent(0.0423)).toBe('4.2%');
		expect(formatPercent(0)).toBe('0.0%');
	});

	test('drops the decimal from 10% upward', () => {
		expect(formatPercent(0.1)).toBe('10%');
	});
});

describe('deltaPercent', () => {
	test('returns null when previous is null', () => {
		expect(deltaPercent(10, null)).toBeNull();
	});

	test('returns null when previous is 0 (no basis)', () => {
		expect(deltaPercent(10, 0)).toBeNull();
	});

	test('computes a positive change', () => {
		expect(deltaPercent(110, 100)).toBeCloseTo(0.1);
	});

	test('computes a negative change', () => {
		expect(deltaPercent(50, 100)).toBeCloseTo(-0.5);
		expect(deltaPercent(0, 5)).toBeCloseTo(-1);
	});
});

describe('formatBucketTick', () => {
	test('hourly bucket shows just the time', () => {
		expect(formatBucketTick('2024-03-15 14:00', 'hour')).toBe('14:00');
	});

	test('hourly midnight tick shows the date instead of 00:00', () => {
		const tick = formatBucketTick('2024-03-15 00:00', 'hour');
		expect(tick).not.toBe('00:00');
		expect(tick).toMatch(/Mar/);
		expect(tick).toMatch(/15/);
	});

	test('daily bucket shows the short date', () => {
		const tick = formatBucketTick('2024-03-15', 'day');
		expect(tick).toMatch(/Mar/);
		expect(tick).toMatch(/15/);
	});
});
