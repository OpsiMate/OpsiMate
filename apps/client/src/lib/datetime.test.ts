import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
	formatDateTime,
	formatLongDateTime,
	formatRelativeTime,
	formatShortDateTime,
	formatTime,
	isSameLocalDay,
	parseUTCDate,
} from './datetime';

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

describe('formatRelativeTime', () => {
	const now = new Date(2026, 7, 11, 12, 0, 0); // Aug 11 2026, 12:00:00

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('a moment ago reads as "just now"', () => {
		expect(formatRelativeTime(new Date(now.getTime() - 30_000))).toBe('just now');
	});

	test('a moment from now reads as "in <1m"', () => {
		expect(formatRelativeTime(new Date(now.getTime() + 30_000))).toBe('in <1m');
	});

	test('minutes, past and future', () => {
		expect(formatRelativeTime(new Date(now.getTime() - 5 * 60_000))).toBe('5m ago');
		expect(formatRelativeTime(new Date(now.getTime() + 5 * 60_000))).toBe('in 5m');
	});

	test('hours, past and future', () => {
		expect(formatRelativeTime(new Date(now.getTime() - 3 * 3_600_000))).toBe('3h ago');
		expect(formatRelativeTime(new Date(now.getTime() + 3 * 3_600_000))).toBe('in 3h');
	});

	test('days under a week, past and future', () => {
		expect(formatRelativeTime(new Date(now.getTime() - 3 * 86_400_000))).toBe('3d ago');
		expect(formatRelativeTime(new Date(now.getTime() + 3 * 86_400_000))).toBe('in 3d');
	});

	test('falls back to an absolute short date-time at a week or beyond', () => {
		const eightDaysAgo = new Date(now.getTime() - 8 * 86_400_000);
		expect(formatRelativeTime(eightDaysAgo)).toBe(formatShortDateTime(eightDaysAgo));

		const eightDaysAhead = new Date(now.getTime() + 8 * 86_400_000);
		expect(formatRelativeTime(eightDaysAhead)).toBe(formatShortDateTime(eightDaysAhead));
	});

	test('empty and unparseable values fall back rather than rendering "Invalid Date"', () => {
		expect(formatRelativeTime(null)).toBe('—');
		expect(formatRelativeTime(undefined)).toBe('—');
		expect(formatRelativeTime('')).toBe('—');
		expect(formatRelativeTime('not-a-date')).toBe('—');
	});

	test('callers can supply their own fallback', () => {
		expect(formatRelativeTime(null, 'no end')).toBe('no end');
	});
});

// MutePolicies renders the absolute window on the line directly above the relative one,
// so capping at a week would leave the two saying the same thing in the same shape.
describe('formatRelativeTime, with the week cap moved', () => {
	const now = new Date(2026, 7, 11, 12, 0, 0);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('Infinity keeps counting days past a week', () => {
		expect(formatRelativeTime(new Date(now.getTime() + 30 * 86_400_000), '—', Infinity)).toBe('in 30d');
		expect(formatRelativeTime(new Date(now.getTime() - 30 * 86_400_000), '—', Infinity)).toBe('30d ago');
	});

	test('a finite value sets where the absolute fallback starts', () => {
		const twoDaysOut = new Date(now.getTime() + 2 * 86_400_000);
		expect(formatRelativeTime(twoDaysOut, '—', 3)).toBe('in 2d');
		expect(formatRelativeTime(twoDaysOut, '—', 2)).toBe(formatShortDateTime(twoDaysOut));
	});
});

// MutePolicies' relativeFromNow, verbatim. A caller separating "no timestamp" from
// "corrupt timestamp" passes `value || fallback`: the first gets the worded fallback, the
// second falls through to its raw text. Stating a wrong fact about the data ("ends no
// end") is worse than showing what actually arrived.
describe('formatRelativeTime, told to separate an absent value from an unparseable one', () => {
	const now = new Date(2026, 7, 11, 12, 0, 0);
	const relativeFromNow = (iso?: string | null): string => formatRelativeTime(iso, iso || 'no end', Infinity);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('an absent timestamp gets the worded fallback', () => {
		expect(relativeFromNow(null)).toBe('no end');
		expect(relativeFromNow(undefined)).toBe('no end');
		expect(relativeFromNow('')).toBe('no end');
	});

	test('an unparseable timestamp falls through to its raw text', () => {
		expect(relativeFromNow('garbage')).toBe('garbage');
	});

	test('a valid timestamp still formats, uncapped', () => {
		expect(relativeFromNow(new Date(now.getTime() + 30 * 86_400_000).toISOString())).toBe('in 30d');
	});
});

// The audit log is the only caller reading SQLite's bare "YYYY-MM-DD HH:MM:SS", and
// nothing in the component pins it to this helper — passing log.timestamp straight to a
// formatter still type-checks and still renders, just silently shifted by the viewer's
// UTC offset. These assertions are what fails if that "simplification" is ever made.
describe('parseUTCDate', () => {
	test('reads a bare SQLite timestamp as UTC, not local time', () => {
		expect(parseUTCDate('2026-08-11 12:00:00').getTime()).toBe(Date.UTC(2026, 7, 11, 12, 0, 0));
		expect(parseUTCDate('2026-08-11 12:00:00').toISOString()).toBe('2026-08-11T12:00:00.000Z');
	});

	test('a bare timestamp two minutes old reads as "2m ago" in any zone', () => {
		vi.useFakeTimers();
		try {
			const nowUtc = Date.UTC(2026, 7, 11, 12, 0, 0);
			vi.setSystemTime(new Date(nowUtc));
			// What the endpoint would return for a row written two minutes ago.
			const sqliteTimestamp = new Date(nowUtc - 2 * 60_000).toISOString().slice(0, 19).replace('T', ' ');
			expect(formatRelativeTime(parseUTCDate(sqliteTimestamp))).toBe('2m ago');
		} finally {
			vi.useRealTimers();
		}
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
