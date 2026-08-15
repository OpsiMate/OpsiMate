import { AlertOwnerInfo, getOwnerDisplayName, getOwnerSortKey } from '@OpsiMate/shared';
import { it, expect, describe } from 'vitest';

// null/undefined ownerId maps to "Unassigned" for display and the
// "zzz_unassigned" sentinel for sorting (so unassigned rows land last)
describe('getOwnerDisplayName and getOwnerSortKey', () => {
	const nullOwnerId = null;
	const undefinedOwnerId = undefined;
	const knownOwnerId = '123';
	const unknownOwnerId = '321';

	const testUser: AlertOwnerInfo = {
		id: '123',
		fullName: 'John Doe',
	};
	const testUsers: AlertOwnerInfo[] = [testUser];

	it('gives `Unassigned` display name and `zzz_unassigned` for a null ownerId', () => {
		const displayNameResult = getOwnerDisplayName(nullOwnerId, testUsers);
		const sortKeyResult = getOwnerSortKey(nullOwnerId, testUsers);

		expect(displayNameResult).toEqual('Unassigned');
		expect(sortKeyResult).toEqual('zzz_unassigned');
	});

	it('gives `Unassigned` display name and `zzz_unassigned` for an undefined ownerId', () => {
		const displayNameResult = getOwnerDisplayName(undefinedOwnerId, testUsers);
		const sortKeyResult = getOwnerSortKey(undefinedOwnerId, testUsers);

		expect(displayNameResult).toEqual('Unassigned');
		expect(sortKeyResult).toEqual('zzz_unassigned');
	});

	it('gives the correct user name for a known owner id', () => {
		const displayNameResult = getOwnerDisplayName(knownOwnerId, testUsers);
		const sortKeyResult = getOwnerSortKey(knownOwnerId, testUsers);

		expect(displayNameResult).toEqual(`${testUser.fullName}`);
		expect(sortKeyResult).toEqual(`${testUser.fullName.toLowerCase()}`);
	});

	it('returns fallback strings for unknown user id', () => {
		const displayNameResult = getOwnerDisplayName(unknownOwnerId, testUsers);
		const sortKeyResult = getOwnerSortKey(unknownOwnerId, testUsers);

		expect(displayNameResult).toEqual(`User ${unknownOwnerId}`);
		expect(sortKeyResult).toEqual(`user_${unknownOwnerId}`);
	});

	it('unassigned entries end up last in a mixed list', () => {
		const testUsersForSorting: AlertOwnerInfo[] = [
			{
				id: '123',
				fullName: 'John Smith',
			},
			{
				id: '000',
				fullName: 'John Smith',
			},
			{
				id: undefined,
				fullName: 'John Smith',
			},
			{
				id: '278645',
				fullName: 'John Smith',
			},
			{
				id: null,
				fullName: 'John Smith',
			},
		];

		const results = [];
		let key: string;

		for (const user of testUsersForSorting) {
			if (user.id === '000')
				key = getOwnerSortKey('111', testUsersForSorting); // unknown user id
			else key = getOwnerSortKey(user.id, testUsersForSorting);

			results.push(key);
		}

		results.sort();
		expect(results).toEqual(['john smith', 'john smith', 'user_111', 'zzz_unassigned', 'zzz_unassigned']);
	});
});
