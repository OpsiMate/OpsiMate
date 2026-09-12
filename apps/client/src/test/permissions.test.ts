import { Role } from '@OpsiMate/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getUserRole } from '@/lib/auth';
import { isPlaygroundMode } from '@/lib/playground';
import {
	canCreate,
	canDelete,
	canEdit,
	canManageIntegrations,
	canManageServices,
	canManageTags,
	canManageUsers,
	canOperate,
	canView,
	hasPermission,
	isReadOnlyMode,
	type Permission,
} from '@/lib/permissions';

vi.mock('@/lib/auth', () => ({ getUserRole: vi.fn() }));
vi.mock('@/lib/playground', () => ({ isPlaygroundMode: vi.fn() }));

const checks: Record<Permission, () => boolean> = {
	create: canCreate,
	edit: canEdit,
	delete: canDelete,
	view: canView,
	operate: canOperate,
};
const permissions = Object.keys(checks) as Permission[];
const roles: { role: Role | null; allowed: Permission[]; users: boolean; services: boolean }[] = [
	{ role: Role.Admin, allowed: ['create', 'edit', 'delete', 'view', 'operate'], users: true, services: true },
	{ role: Role.Editor, allowed: ['create', 'edit', 'view', 'operate'], users: false, services: true },
	{ role: Role.Viewer, allowed: ['view'], users: false, services: false },
	{ role: Role.Operation, allowed: ['view', 'operate'], users: false, services: false },
	{ role: null, allowed: [], users: false, services: false },
];

beforeEach(() => {
	vi.resetAllMocks();
});

describe.each(roles)('permissions for $role', ({ role, allowed, users, services }) => {
	beforeEach(() => {
		vi.mocked(getUserRole).mockReturnValue(role);
		vi.mocked(isPlaygroundMode).mockReturnValue(false);
	});

	test.each(permissions)('%s permission and its convenience helper', (permission) => {
		const expected = allowed.includes(permission);
		expect(hasPermission(permission)).toBe(expected);
		expect(checks[permission]()).toBe(expected);
	});

	test('feature management permissions', () => {
		expect(canManageUsers()).toBe(users);
		expect(canManageIntegrations()).toBe(users);
		expect(canManageServices()).toBe(services);
		expect(canManageTags()).toBe(services);
	});

	describe('in read-only playground mode', () => {
		beforeEach(() => {
			vi.mocked(isPlaygroundMode).mockReturnValue(true);
		});

		test.each(permissions)('%s permission and its convenience helper', (permission) => {
			const expected = permission === 'view' && allowed.includes('view');
			expect(hasPermission(permission)).toBe(expected);
			expect(checks[permission]()).toBe(expected);
		});

		test('blocks every feature management action, including for admins', () => {
			expect(canManageUsers()).toBe(false);
			expect(canManageIntegrations()).toBe(false);
			expect(canManageServices()).toBe(false);
			expect(canManageTags()).toBe(false);
		});
	});
});

test.each([false, true])('read-only mode follows playground mode (%s)', (playground) => {
	vi.mocked(isPlaygroundMode).mockReturnValue(playground);
	expect(isReadOnlyMode()).toBe(playground);
});
