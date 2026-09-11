import { describe, expect, it } from 'vitest';
import { extractTagKeyFromColumnId, getTagKeyColumnId, isTagKeyColumn } from '@/types/TagKey';

describe('TagKey column ID helpers', () => {
	it.each(['environment', 'team', 'service:name'])('round trips the tag key %j', (tagKey) => {
		expect(extractTagKeyFromColumnId(getTagKeyColumnId(tagKey))).toBe(tagKey);
	});

	it.each(['alertName', 'severity'])('does not treat %j as a tag column', (columnId) => {
		expect(isTagKeyColumn(columnId)).toBe(false);
	});

	it('returns null for a non-tag column ID', () => {
		expect(extractTagKeyFromColumnId('alertName')).toBeNull();
	});

	it('round trips an empty tag key', () => {
		expect(extractTagKeyFromColumnId(getTagKeyColumnId(''))).toBe('');
	});
});
