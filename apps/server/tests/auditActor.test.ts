import { describe, expect, test } from 'vitest';
import { Role, User } from '@OpsiMate/shared';
import { API_TOKEN_ACTOR_ID, API_TOKEN_ACTOR_NAME, toAuditActor } from '../src/bl/audit/auditActor';

const buildUser = (overrides: Partial<User> = {}): User => ({
	id: '42',
	email: 'ada@example.com',
	fullName: 'Ada Lovelace',
	role: Role.Admin,
	createdAt: '2026-10-28T00:00:00.000Z',
	...overrides,
});

describe('toAuditActor', () => {
	test('converts a numeric-string user id and keeps the full name', () => {
		expect(toAuditActor(buildUser())).toEqual({ userId: 42, userName: 'Ada Lovelace' });
	});

	test('falls back to the API token actor when the actor is missing', () => {
		expect(toAuditActor()).toEqual({ userId: API_TOKEN_ACTOR_ID, userName: API_TOKEN_ACTOR_NAME });
		expect(toAuditActor(null)).toEqual({ userId: API_TOKEN_ACTOR_ID, userName: API_TOKEN_ACTOR_NAME });
	});

	test('falls back to the API token id when the user id is not numeric', () => {
		expect(toAuditActor(buildUser({ id: 'not-a-number' }))).toEqual({
			userId: API_TOKEN_ACTOR_ID,
			userName: 'Ada Lovelace',
		});
	});

	test('falls back to the API token name when the full name is nullish', () => {
		const actor = { ...buildUser(), fullName: null } as unknown as User;
		expect(toAuditActor(actor)).toEqual({ userId: 42, userName: API_TOKEN_ACTOR_NAME });
	});
});
