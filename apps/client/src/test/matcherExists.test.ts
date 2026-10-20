import {
	cleanMatcherGroups,
	describeMatcherCriteria,
} from '@/components/shared/MatcherGroupsEditor/MatcherGroupsEditor';
import { anyMatcherGroupMatchesTags, flagEmojiForCode, looksLikeCountryCode } from '@OpsiMate/shared';
import { describe, expect, test } from 'vitest';

// The "exists" operator: a matcher that needs no value, so one rule can cover every alert
// carrying a label; and the {{flag.<key>}} helper it is usually paired with.
describe('exists matcher', () => {
	test('matches any present value, never an absent tag', () => {
		const groups = [[{ key: 'site', value: '', op: 'exists' as const }]];
		expect(anyMatcherGroupMatchesTags(groups, { site: 'IL' })).toBe(true);
		expect(anyMatcherGroupMatchesTags(groups, { site: '' })).toBe(true);
		expect(anyMatcherGroupMatchesTags(groups, { env: 'prod' })).toBe(false);
		expect(anyMatcherGroupMatchesTags(groups, undefined)).toBe(false);
	});

	test('survives cleaning without a value and reads as "key exists"', () => {
		const cleaned = cleanMatcherGroups([
			[
				{ key: ' site ', value: 'ignored', op: 'exists' },
				{ key: 'env', value: 'prod' },
				{ key: 'team', value: '' },
			],
		]);
		expect(cleaned).toEqual([
			[
				{ key: 'site', value: '', op: 'exists' },
				{ key: 'env', value: 'prod' },
			],
		]);
		expect(describeMatcherCriteria({ labelMatcherGroups: cleaned })).toBe('site exists AND env=prod');
	});
});

describe('flag template helper', () => {
	test('two letters become the flag, case-insensitively; anything else becomes nothing', () => {
		expect(flagEmojiForCode('IL')).toBe('🇮🇱');
		expect(flagEmojiForCode(' us ')).toBe('🇺🇸');
		expect(flagEmojiForCode('prod')).toBe('');
		expect(flagEmojiForCode('I')).toBe('');
		expect(looksLikeCountryCode('de')).toBe(true);
		expect(looksLikeCountryCode('eu-west-1')).toBe(false);
	});
});
