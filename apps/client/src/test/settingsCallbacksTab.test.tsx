import { Role } from '@OpsiMate/shared';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as api from '@/lib/api';
import Settings from '@/pages/Settings';
import { render, screen } from './test-utils';

// The Callbacks tab is admin only on the server; the page must not offer it to anyone
// else (they would get a "New callback" button that can only fail with 403).

interface CurrentUserState {
	role: Role;
}

// Read lazily by the mock below, at render time.
const userState: CurrentUserState = { role: Role.Admin };

vi.mock('@/lib/auth', async () => ({
	...(await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth')),
	getCurrentUser: () => ({ id: 1, email: 'me@example.com', role: userState.role }),
}));

vi.mock('@/hooks/queries/callbacks', () => ({
	useCallbacks: () => ({ data: [], isLoading: false, error: null }),
	useCreateCallback: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useUpdateCallback: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useDeleteCallback: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useTestCallback: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('Settings: Callbacks tab', () => {
	let originalHash: string;

	beforeEach(() => {
		originalHash = window.location.hash;
		vi.spyOn(api, 'apiRequest').mockResolvedValue({ success: true, data: [] });
		vi.spyOn(api.auditApi, 'getAuditLogs').mockResolvedValue({ success: true, data: { logs: [], total: 0 } });
	});

	afterEach(() => {
		window.location.hash = originalHash;
		userState.role = Role.Admin;
		vi.restoreAllMocks();
	});

	test('an admin sees the tab, and #callbacks opens it', async () => {
		userState.role = Role.Admin;
		window.location.hash = '#callbacks';
		render(<Settings />);
		expect(await screen.findByRole('tab', { name: 'Callbacks' })).toHaveAttribute('aria-selected', 'true');
	});

	test('a non-admin gets no Callbacks tab; #callbacks lands on Users, not a blank page', async () => {
		userState.role = Role.Editor;
		window.location.hash = '#callbacks';
		render(<Settings />);
		expect(await screen.findByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.queryByRole('tab', { name: 'Callbacks' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /new callback/i })).not.toBeInTheDocument();
	});

	test('a hash naming an Object.prototype member falls back to Users', async () => {
		window.location.hash = '#constructor';
		render(<Settings />);
		expect(await screen.findByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true');
	});
});
