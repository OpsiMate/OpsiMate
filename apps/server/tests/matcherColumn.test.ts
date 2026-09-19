import { describe, expect, test } from 'vitest';
import { parseMatcherColumn, serializeMatcherColumn } from '../src/dal/matcherColumn';

const emptyMatchers = { labelMatchers: [], labelMatcherGroups: [] };
const environmentMatcher = { key: 'env', value: 'prod' };
const serviceMatcher = { key: 'service', value: 'api', op: 'contains' as const };

describe('parseMatcherColumn', () => {
	test.each([null, '', '[]'])('returns empty matchers for %j', (raw) => {
		expect(parseMatcherColumn(raw)).toEqual(emptyMatchers);
	});

	test('reads a legacy flat matcher list as one group', () => {
		const matchers = [environmentMatcher, serviceMatcher];

		expect(parseMatcherColumn(JSON.stringify(matchers))).toEqual({
			labelMatchers: matchers,
			labelMatcherGroups: [matchers],
		});
	});

	test('reads nested groups and mirrors the first group for legacy consumers', () => {
		const groups = [[environmentMatcher], [serviceMatcher]];

		expect(parseMatcherColumn(JSON.stringify(groups))).toEqual({
			labelMatchers: groups[0],
			labelMatcherGroups: groups,
		});
	});

	test('returns empty matchers for malformed JSON', () => {
		expect(parseMatcherColumn('[{"key":')).toEqual(emptyMatchers);
	});
});

describe('serializeMatcherColumn', () => {
	test('writes one group as a legacy flat list', () => {
		expect(serializeMatcherColumn({ labelMatcherGroups: [[environmentMatcher, serviceMatcher]] })).toBe(
			JSON.stringify([environmentMatcher, serviceMatcher])
		);
	});

	test('writes several groups as a nested list', () => {
		const groups = [[environmentMatcher], [serviceMatcher]];

		expect(serializeMatcherColumn({ labelMatcherGroups: groups })).toBe(JSON.stringify(groups));
	});

	test('writes no groups as an empty list', () => {
		expect(serializeMatcherColumn({})).toBe('[]');
	});

	test('round-trips the legacy flat shape', () => {
		const matchers = [environmentMatcher, serviceMatcher];
		const raw = serializeMatcherColumn({ labelMatchers: matchers });

		expect(parseMatcherColumn(raw)).toEqual({
			labelMatchers: matchers,
			labelMatcherGroups: [matchers],
		});
	});

	test('round-trips the grouped shape', () => {
		const groups = [[environmentMatcher], [serviceMatcher]];
		const raw = serializeMatcherColumn({ labelMatcherGroups: groups });

		expect(parseMatcherColumn(raw)).toEqual({
			labelMatchers: groups[0],
			labelMatcherGroups: groups,
		});
	});
});
