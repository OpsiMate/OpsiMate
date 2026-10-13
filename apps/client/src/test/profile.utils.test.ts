import { describe, expect, it } from 'vitest';
import { getInitials } from '@/components/Profile/utils/profile.utils';

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
