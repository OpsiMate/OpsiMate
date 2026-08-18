import { describe, expect, test } from 'vitest';
import { MatcherCriteria } from '@OpsiMate/shared';
import { describeCriteriaScope } from '@/components/shared/MatcherGroupsEditor';

// The rule tables sort their Match / Applies-to column by this string, so it has to be
// the whole cell: anything it leaves out makes two visibly different rows sort as equal,
// which reads as the sort being broken.

describe('describeCriteriaScope', () => {
	test('name needles read the way the badge writes them', () => {
		expect(describeCriteriaScope({ nameContainsAny: ['cpu', 'mem'] } as MatcherCriteria)).toBe(
			'name ~ "cpu" or "mem"'
		);
	});

	test('label matchers keep their AND / OR structure', () => {
		const criteria = {
			labelMatcherGroups: [
				[
					{ key: 'env', value: 'prod' },
					{ key: 'team', value: 'db', op: 'contains' },
				],
				[{ key: 'env', value: 'staging' }],
			],
		} as unknown as MatcherCriteria;
		expect(describeCriteriaScope(criteria)).toBe('env=prod AND team~db OR env=staging');
	});

	test('name and labels appear in the order the cell renders them', () => {
		const criteria = {
			nameContains: 'disk',
			labelMatchers: [{ key: 'env', value: 'prod' }],
		} as unknown as MatcherCriteria;
		expect(describeCriteriaScope(criteria)).toBe('name ~ "disk" env=prod');
	});

	// matchAll is NOT exclusive with name needles: a policy can show both badges. Keying
	// off matchAll alone collapsed every such rule to bare "All alerts", so rules with
	// different names sorted as identical.
	test('a match-all rule that also has a name keeps the name in the key', () => {
		expect(describeCriteriaScope({ nameContains: 'disk' } as MatcherCriteria, true)).toBe(
			'name ~ "disk" All alerts'
		);
		expect(describeCriteriaScope({ nameContains: 'cpu' } as MatcherCriteria, true)).not.toBe(
			describeCriteriaScope({ nameContains: 'disk' } as MatcherCriteria, true)
		);
	});

	test('match-all replaces the matchers rather than joining them', () => {
		const criteria = { labelMatchers: [{ key: 'env', value: 'prod' }] } as unknown as MatcherCriteria;
		expect(describeCriteriaScope(criteria, true)).toBe('All alerts');
	});

	test('no criteria at all is the empty string, which useTableSort treats as absent', () => {
		expect(describeCriteriaScope({} as MatcherCriteria)).toBe('');
	});
});
