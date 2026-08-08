import { describe, expect, it } from 'vitest';
import { validationRules } from './ValidationFeedback';

const EXPECTED_TAG_NAME_MAX_LENGTH = 50;
const EXPECTED_TAG_NAME_MAX_LENGTH_LABEL = 'Must be 50 characters or less';

const tagLengthRule = validationRules.tagName.find((rule) => rule.id === 'tag-length');

if (!tagLengthRule) {
	throw new Error('Expected the tag-length validation rule to exist');
}

describe('tag name length validation', () => {
	it('describes the inclusive 50-character limit', () => {
		expect(tagLengthRule.label).toBe(EXPECTED_TAG_NAME_MAX_LENGTH_LABEL);
	});

	it('accepts 50 characters and rejects 51 characters', () => {
		expect(tagLengthRule.validator('a'.repeat(EXPECTED_TAG_NAME_MAX_LENGTH))).toBe(true);
		expect(tagLengthRule.validator('a'.repeat(EXPECTED_TAG_NAME_MAX_LENGTH + 1))).toBe(false);
	});
});
