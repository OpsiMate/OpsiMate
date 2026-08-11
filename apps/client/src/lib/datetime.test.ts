import { describe, expect, test } from 'vitest';
import { formatDateTime, formatLongDateTime, formatShortDateTime, formatTime, isSameLocalDay } from './datetime';

// Every formatter here is 24-hour by contract. MERIDIEM is asserted against directly
// rather than checking for an exact string, so these stay honest under any locale.
const MERIDIEM = /\b[AP]\.?M\.?\b/i;

// Local-time constructors throughout: the formatters render in the viewer's zone, so
// building the inputs the same way keeps the expectations timezone-independent.
const afternoon = new Date(2026, 7, 11, 22, 53, 7); // Aug 11 2026, 22:53:07
const midnight = new Date(2026, 7, 11, 0, 5, 3);
const noon = new Date(2026, 7, 11, 12, 0, 0);
const singleDigitHour = new Date(2026, 7, 11, 9, 4, 5);

describe('formatTime', () => {
	test('renders a 24-hour clock with seconds', () => {
		expect(formatTime(afternoon)).toBe('22:53:07');
	});

	test('never emits a meridiem suffix', () => {
		for (const date of [afternoon, midnight, noon, singleDigitHour]) {
			expect(formatTime(date)).not.toMatch(MERIDIEM);
		}
	});

	test('midnight is 00, not 24 — the case hour12: false gets wrong', () => {
		expect(formatTime(midnight)).toBe('00:05:03');
	});

	test('noon is 12 and stays distinct from midnight', () => {
		expect(formatTime(noon)).toBe('12:00:00');
		expect(formatTime(noon)).not.toBe(formatTime(midnight));
	});

	test('single-digit hours keep a leading zero so columns stay aligned', () => {
		expect(formatTime(singleDigitHour)).toBe('09:04:05');
	});
});

describe('formatShortDateTime', () => {
	test('renders day, month and a 24-hour clock', () => {
		const formatted = formatShortDateTime(afternoon);
		expect(formatted).toContain('22:53');
		expect(formatted).not.toMatch(MERIDIEM);
	});

	test('omits the year but keeps the calendar day', () => {
		const formatted = formatShortDateTime(afternoon);
		expect(formatted).not.toContain('2026');
		expect(formatted).toContain('11');
	});

	test('midnight stays 00', () => {
		expect(formatShortDateTime(midnight)).toContain('00:05');
	});
});

describe('formatLongDateTime', () => {
	test('carries the year alongside a 24-hour clock', () => {
		const formatted = formatLongDateTime(afternoon);
		expect(formatted).toContain('2026');
		expect(formatted).toContain('22:53');
		expect(formatted).not.toMatch(MERIDIEM);
	});
});

describe('formatDateTime', () => {
	test('renders full precision for tooltips and copied values', () => {
		const formatted = formatDateTime(afternoon);
		expect(formatted).toContain('2026');
		expect(formatted).toContain('22:53:07');
		expect(formatted).not.toMatch(MERIDIEM);
	});

	test('midnight stays 00 at full precision too', () => {
		expect(formatDateTime(midnight)).toContain('00:05:03');
	});
});

describe('input handling', () => {
	test('accepts ISO strings, epoch numbers and Date objects alike', () => {
		const iso = afternoon.toISOString();
		expect(formatTime(iso)).toBe('22:53:07');
		expect(formatTime(afternoon.getTime())).toBe('22:53:07');
		expect(formatTime(afternoon)).toBe('22:53:07');
	});

	test('empty and nullish values fall back rather than rendering "Invalid Date"', () => {
		for (const formatter of [formatTime, formatShortDateTime, formatLongDateTime, formatDateTime]) {
			expect(formatter(null)).toBe('—');
			expect(formatter(undefined)).toBe('—');
			expect(formatter('')).toBe('—');
		}
	});

	test('unparseable values fall back', () => {
		expect(formatTime('not-a-date')).toBe('—');
		expect(formatDateTime('not-a-date')).toBe('—');
	});

	test('callers can supply their own fallback', () => {
		expect(formatDateTime(null, 'never')).toBe('never');
		expect(formatShortDateTime('not-a-date', 'not-a-date')).toBe('not-a-date');
	});
});

describe('isSameLocalDay', () => {
	const reference = new Date(2026, 7, 11, 14, 0, 0);

	test('true anywhere inside the same calendar day', () => {
		expect(isSameLocalDay(new Date(2026, 7, 11, 0, 0, 0), reference)).toBe(true);
		expect(isSameLocalDay(new Date(2026, 7, 11, 23, 59, 59), reference)).toBe(true);
	});

	test('false one minute either side of the day boundary', () => {
		expect(isSameLocalDay(new Date(2026, 7, 10, 23, 59, 0), reference)).toBe(false);
		expect(isSameLocalDay(new Date(2026, 7, 12, 0, 1, 0), reference)).toBe(false);
	});

	test('same day-of-month in a different month or year is not today', () => {
		expect(isSameLocalDay(new Date(2026, 6, 11, 14, 0, 0), reference)).toBe(false);
		expect(isSameLocalDay(new Date(2025, 7, 11, 14, 0, 0), reference)).toBe(false);
	});

	test('unparseable values are never today', () => {
		expect(isSameLocalDay('not-a-date', reference)).toBe(false);
		expect(isSameLocalDay(null, reference)).toBe(false);
	});
});
