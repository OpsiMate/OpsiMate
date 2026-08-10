import { describe, expect, test } from 'vitest';
import { cleanMatcherGroups } from '@/components/shared/MatcherGroupsEditor';

describe('cleanMatcherGroups', () => {
	test('preserves the contains op through cleaning — the exact bug where the UI collected it and the submit stripped it', () => {
		expect(cleanMatcherGroups([[{ key: ' svc ', value: ' cpu ', op: 'contains' }]])).toEqual([
			[{ key: 'svc', value: 'cpu', op: 'contains' }],
		]);
	});

	test('equals rows stay bare (no op key), keeping stored rows minimal', () => {
		expect(cleanMatcherGroups([[{ key: 'svc', value: 'x' }]])).toEqual([[{ key: 'svc', value: 'x' }]]);
		expect(Object.keys(cleanMatcherGroups([[{ key: 'svc', value: 'x', op: 'equals' }]])[0][0])).toEqual([
			'key',
			'value',
		]);
	});

	test('drops incomplete rows and empty groups', () => {
		expect(
			cleanMatcherGroups([
				[{ key: '', value: 'x' }],
				[
					{ key: 'a', value: '1' },
					{ key: '', value: '' },
				],
			])
		).toEqual([[{ key: 'a', value: '1' }]]);
	});
});
