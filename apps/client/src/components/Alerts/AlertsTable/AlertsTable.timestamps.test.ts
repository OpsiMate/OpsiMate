import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { formatDate, formatFullTimestamp } from './AlertsTable.utils';

// The table's Started At / Last Updated cells render on a 24-hour clock. These tests pin
// the absence of an AM/PM suffix and the midnight-is-00 rule, which is the specific thing
// hour12: false gets wrong in locales that resolve to an h24 cycle.
const MERIDIEM = /\b[AP]\.?M\.?\b/i;

// formatDate branches on "is this today?", so every case runs against a frozen clock.
const setNow = (date: Date) => {
	vi.useFakeTimers();
	vi.setSystemTime(date);
};

afterEach(() => vi.useRealTimers());

describe('formatDate — 24-hour clock', () => {
	beforeEach(() => setNow(new Date(2026, 5, 15, 14, 30, 0)));

	test('afternoon times render as 24-hour, never with a meridiem suffix', () => {
		const afternoon = new Date(2026, 5, 15, 14, 30, 45);
		const formatted = formatDate(afternoon.toISOString());
		expect(formatted).toBe('14:30:45');
		expect(formatted).not.toMatch(MERIDIEM);
	});

	test('a time that would read 11:05 PM renders as 23:05', () => {
		const lateEvening = new Date(2026, 5, 15, 23, 5, 9);
		expect(formatDate(lateEvening.toISOString())).toBe('23:05:09');
	});

	test('midnight is 00, not 24 and not 12 AM', () => {
		const justAfterMidnight = new Date(2026, 5, 15, 0, 7, 3);
		const formatted = formatDate(justAfterMidnight.toISOString());
		expect(formatted).toBe('00:07:03');
		expect(formatted).not.toContain('24:');
		expect(formatted).not.toMatch(MERIDIEM);
	});

	test('noon is 12, distinct from midnight', () => {
		expect(formatDate(new Date(2026, 5, 15, 12, 0, 0).toISOString())).toBe('12:00:00');
	});

	test('single-digit hours keep a leading zero so the column stays aligned', () => {
		expect(formatDate(new Date(2026, 5, 15, 9, 4, 5).toISOString())).toBe('09:04:05');
	});

	test('older timestamps carry the date and still use the 24-hour clock', () => {
		const yesterday = new Date(2026, 5, 14, 22, 15, 0);
		const formatted = formatDate(yesterday.toISOString());
		expect(formatted).toContain('22:15:00');
		expect(formatted).toContain('2026');
		expect(formatted).not.toMatch(MERIDIEM);
	});

	test('unparseable input is reported rather than thrown', () => {
		expect(formatDate('not-a-date')).toBe('Invalid Date');
		expect(formatDate('')).toBe('Invalid Date');
	});
});

describe('formatFullTimestamp — tooltip and copied value', () => {
	beforeEach(() => setNow(new Date(2026, 5, 15, 14, 30, 0)));

	test('always includes the date, even for today', () => {
		const today = new Date(2026, 5, 15, 14, 30, 45);
		const formatted = formatFullTimestamp(today.toISOString());
		expect(formatted).toContain('2026');
		expect(formatted).toContain('14:30:45');
		expect(formatted).not.toMatch(MERIDIEM);
	});

	test('midnight stays 00 in the full timestamp too', () => {
		const formatted = formatFullTimestamp(new Date(2026, 5, 15, 0, 0, 0).toISOString());
		expect(formatted).toContain('00:00:00');
		expect(formatted).not.toContain('24:00:00');
	});

	test('returns undefined for an unparseable value so callers can fall back', () => {
		expect(formatFullTimestamp('not-a-date')).toBeUndefined();
		expect(formatFullTimestamp('')).toBeUndefined();
	});
});
