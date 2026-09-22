import { describe, expect, it } from 'vitest';
import { formatDate, getInitials } from '@/components/Profile/utils/profile.utils';

describe('getInitials', () => {
	it.each([
		['', '?'],
		['   ', '?'],
		['Santiago', 'S'],
		['alice bob', 'AB'],
		['Alice Bob Carol', 'AB'],
	])('formats %j as %j', (name, expected) => {
		expect(getInitials(name)).toBe(expected);
	});
});

describe('formatDate', () => {
	it('formats a date with the expected month, day, and year', () => {
		const date = new Date(2026, 7, 11, 12, 0, 0);

		expect(formatDate(date.toISOString())).toBe('August 11, 2026');
	});
});
