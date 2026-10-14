import { describe, expect, test } from 'vitest';
import { pluralize } from './text';

describe('pluralize', () => {
	test.each([
		[0, 'alert', 'alerts'],
		[1, 'alert', 'alert'],
		[2, 'alert', 'alerts'],
	])('returns the right form for count %s', (count, singular, expected) => {
		expect(pluralize(count, singular)).toBe(expected);
	});

	test('supports irregular plurals', () => {
		expect(pluralize(2, 'match', 'matches')).toBe('matches');
		expect(pluralize(1, 'match', 'matches')).toBe('match');
	});
});
