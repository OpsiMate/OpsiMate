import { UserInfo } from '@/hooks/queries/users';

/**
 * Get the display name for an alert owner.
 * Returns the user's full name, "Unassigned" for null/undefined, or a fallback for unknown users.
 */
export const getOwnerDisplayName = (ownerId: string | null | undefined, users: UserInfo[]): string => {
	if (ownerId === null || ownerId === undefined) return 'Unassigned';
	const user = users.find((u) => u.id === ownerId);
	return user?.fullName || `User ${ownerId}`;
};

/**
 * Get the sort key for an owner (for alphabetical sorting).
 * Unassigned owners sort to the end.
 */
export const getOwnerSortKey = (ownerId: string | null | undefined, users: UserInfo[]): string => {
	if (ownerId === null || ownerId === undefined) return 'zzz_unassigned';
	const user = users.find((u) => u.id === ownerId);
	return user?.fullName?.toLowerCase() || `user_${ownerId}`;
};
