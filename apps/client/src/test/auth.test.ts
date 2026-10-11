import { Role } from '@OpsiMate/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLogger, mockIsPlaygroundMode, mockGetPlaygroundUser } = vi.hoisted(() => ({
	mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
	mockIsPlaygroundMode: vi.fn(),
	mockGetPlaygroundUser: vi.fn(),
}));

vi.mock('@OpsiMate/shared', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@OpsiMate/shared')>();
	return {
		...actual,
		Logger: function () {
			return mockLogger;
		},
	};
});

vi.mock('@/lib/playground', () => ({
	isPlaygroundMode: mockIsPlaygroundMode,
	getPlaygroundUser: mockGetPlaygroundUser,
}));

import {
	AUTH_TOKEN_STORAGE_KEY,
	getCurrentUser,
	getUserRole,
	isAdmin,
	isEditor,
	isOperation,
	isViewer,
} from '@/lib/auth';

const base64url = (value: object): string =>
	btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// No signature check happens client-side, so a dummy signature is fine.
const makeToken = (payload: Record<string, unknown>): string =>
	`${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.signature`;

const makePayload = (role: Role) => ({
	id: 7,
	email: 'user@example.com',
	role,
	iat: 1700000000,
	exp: 1900000000,
});

const storeTokenFor = (role: Role) => {
	localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, makeToken(makePayload(role)));
};

describe('lib/auth', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		mockIsPlaygroundMode.mockReturnValue(false);
	});

	describe('getCurrentUser', () => {
		it('returns the synthetic playground user in playground mode', () => {
			mockIsPlaygroundMode.mockReturnValue(true);
			mockGetPlaygroundUser.mockReturnValue({
				id: '42',
				email: 'playground@example.com',
				role: Role.Admin,
			});

			expect(getCurrentUser()).toEqual({
				id: 42,
				email: 'playground@example.com',
				role: Role.Admin,
				iat: 0,
				exp: 0,
			});
		});

		it('falls back to id 0 when the playground user id is not numeric', () => {
			mockIsPlaygroundMode.mockReturnValue(true);
			mockGetPlaygroundUser.mockReturnValue({
				id: 'playground-user',
				email: 'playground@example.com',
				role: Role.Viewer,
			});

			expect(getCurrentUser()?.id).toBe(0);
		});

		it('ignores a stored token in playground mode', () => {
			mockIsPlaygroundMode.mockReturnValue(true);
			mockGetPlaygroundUser.mockReturnValue({
				id: '1',
				email: 'playground@example.com',
				role: Role.Viewer,
			});
			storeTokenFor(Role.Admin);

			expect(getCurrentUser()?.role).toBe(Role.Viewer);
		});

		it('returns null when there is no token in storage', () => {
			expect(getCurrentUser()).toBeNull();
			expect(mockLogger.error).not.toHaveBeenCalled();
		});

		it('returns the decoded payload for a valid token', () => {
			const payload = makePayload(Role.Editor);
			localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, makeToken(payload));

			expect(getCurrentUser()).toEqual(payload);
		});

		it('returns null and logs the error for a malformed token', () => {
			localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'not-a-jwt');

			expect(() => getCurrentUser()).not.toThrow();
			expect(getCurrentUser()).toBeNull();
			expect(mockLogger.error).toHaveBeenCalledWith('Failed to decode JWT token:', expect.anything());
		});

		it('returns null for a token whose payload is not valid base64 JSON', () => {
			localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'aaa.%%%.ccc');

			expect(getCurrentUser()).toBeNull();
			expect(mockLogger.error).toHaveBeenCalled();
		});
	});

	describe('role helpers', () => {
		const cases = [
			{ role: Role.Admin, admin: true, editor: true, viewer: false, operation: false },
			{ role: Role.Editor, admin: false, editor: true, viewer: false, operation: false },
			{ role: Role.Viewer, admin: false, editor: false, viewer: true, operation: false },
			{ role: Role.Operation, admin: false, editor: false, viewer: false, operation: true },
		];

		it.each(cases)('returns the right flags for $role', ({ role, admin, editor, viewer, operation }) => {
			storeTokenFor(role);

			expect(isAdmin()).toBe(admin);
			expect(isEditor()).toBe(editor);
			expect(isViewer()).toBe(viewer);
			expect(isOperation()).toBe(operation);
		});

		it.each(cases)('getUserRole returns $role', ({ role }) => {
			storeTokenFor(role);

			expect(getUserRole()).toBe(role);
		});

		it('returns false / null for every helper when there is no token', () => {
			expect(isAdmin()).toBe(false);
			expect(isEditor()).toBe(false);
			expect(isViewer()).toBe(false);
			expect(isOperation()).toBe(false);
			expect(getUserRole()).toBeNull();
		});

		it('returns false / null for every helper when the token is malformed', () => {
			localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'garbage');

			expect(isAdmin()).toBe(false);
			expect(isEditor()).toBe(false);
			expect(isViewer()).toBe(false);
			expect(isOperation()).toBe(false);
			expect(getUserRole()).toBeNull();
		});
	});
});
