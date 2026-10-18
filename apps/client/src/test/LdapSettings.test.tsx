import { LdapSettings } from '@/components/Settings/LdapSettings';
import { LdapSettings as LdapSettingsData } from '@OpsiMate/shared';
import { LdapRequestError } from '@/hooks/queries/ldap';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AllTheProviders } from './TestProviders';

// The query hooks are mocked at the module boundary: this test is about what the form
// lets an admin do, not about fetching.
const { mutateAsync, testAsync, settingsState, pendingState } = vi.hoisted(() => ({
	mutateAsync: vi.fn(),
	testAsync: vi.fn(),
	settingsState: { current: null as LdapSettingsData | null },
	pendingState: { save: false, test: false },
}));
vi.mock('@/hooks/queries/ldap', async () => ({
	...(await vi.importActual<typeof import('@/hooks/queries/ldap')>('@/hooks/queries/ldap')),
	useLdapSettings: () => ({ data: settingsState.current, isLoading: false, error: null }),
	useUpdateLdapSettings: () => ({ mutateAsync, mutate: vi.fn(), isPending: pendingState.save }),
	useTestLdapConnection: () => ({ mutateAsync: testAsync, isPending: pendingState.test }),
}));

const settings = (overrides: Partial<LdapSettingsData> = {}): LdapSettingsData => ({
	source: 'database',
	enabled: true,
	problems: [],
	url: 'ldaps://ldap.example.com',
	startTls: false,
	bindDn: 'cn=svc,dc=example,dc=com',
	hasBindPassword: true,
	searchBase: 'ou=people,dc=example,dc=com',
	searchFilter: '(mail={{email}})',
	emailAttribute: 'mail',
	nameAttribute: 'displayName',
	groupsAttribute: 'memberOf',
	groupSearchBase: '',
	groupSearchFilter: '(member={{dn}})',
	roleMapping: { admin: ['cn=ops,dc=example,dc=com'], editor: [], operation: [], viewer: [] },
	defaultRole: null,
	timeoutMs: 5000,
	loginMaxFailures: 5,
	tlsRejectUnauthorized: true,
	tlsCaCert: '',
	updatedAt: null,
	...overrides,
});

const renderOpen = () =>
	render(
		<AllTheProviders>
			<LdapSettings defaultOpen />
		</AllTheProviders>
	);

const saveButton = () => screen.getByRole('button', { name: /^save/i });
const testButton = () => screen.getByRole('button', { name: /test connection/i });

beforeEach(() => {
	mutateAsync.mockReset();
	mutateAsync.mockImplementation(async () => settingsState.current);
	testAsync.mockReset();
	testAsync.mockImplementation(async () => ({ ok: true, latencyMs: 12, steps: [], user: null }));
	settingsState.current = settings();
	pendingState.save = false;
	pendingState.test = false;
});

describe('LdapSettings', () => {
	test('changing the server URL asks for the password again before Save', () => {
		renderOpen();
		fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'ldap://attacker.example.com' } });
		expect(screen.getByText(/Re-enter the password/)).toBeInTheDocument();
		expect(saveButton()).toBeDisabled();

		fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'svc-secret' } });
		expect(saveButton()).toBeEnabled();
	});

	test('changing an unrelated field saves without the password', () => {
		renderOpen();
		fireEvent.change(screen.getByLabelText('Name attribute'), { target: { value: 'cn' } });
		expect(screen.queryByText(/Re-enter the password/)).not.toBeInTheDocument();
		expect(saveButton()).toBeEnabled();
	});

	test('a blank timeout is left out of the update instead of sent as 0', () => {
		renderOpen();
		fireEvent.change(screen.getByLabelText('Timeout (ms)'), { target: { value: '' } });
		fireEvent.click(saveButton());
		expect(mutateAsync).toHaveBeenCalledTimes(1);
		const sent = mutateAsync.mock.calls[0][0];
		expect(sent).not.toHaveProperty('timeoutMs');
		expect(sent).toHaveProperty('loginMaxFailures', 5);
		expect(sent).not.toHaveProperty('bindPassword');
	});

	test('switched on but unusable shows "Not active" and why', () => {
		settingsState.current = settings({ problems: ['bind_password (bind_dn is set)'] });
		renderOpen();
		expect(screen.getByText('Not active')).toBeInTheDocument();
		expect(screen.getByText(/not in effect/)).toHaveTextContent('bind_password');
	});

	test('server-managed settings are read-only', () => {
		settingsState.current = settings({ source: 'config' });
		renderOpen();
		expect(screen.getByLabelText('Server URL')).toBeDisabled();
		expect(screen.queryByRole('button', { name: /^save/i })).not.toBeInTheDocument();
	});

	test.each(['save', 'test'] as const)('the form is frozen while a %s is in flight', (which) => {
		pendingState[which] = true;
		renderOpen();
		expect(screen.getByLabelText('Server URL')).toBeDisabled();
		expect(screen.getByLabelText('Password')).toBeDisabled();
		expect(screen.getByLabelText('Admin groups')).toBeDisabled();
		expect(screen.getByRole('button', { name: /test connection|testing/i })).toBeDisabled();
	});

	test('a refused save names the field under the input, not just "Validation error"', async () => {
		mutateAsync.mockImplementation(async () => {
			throw new LdapRequestError(
				{
					success: false,
					error: 'Validation error',
					details: [
						{ path: ['url'], message: 'Expected ldap://host[:port] or ldaps://host[:port]' },
						'search_base',
					],
				},
				'Failed to update LDAP settings'
			);
		});
		renderOpen();
		fireEvent.change(screen.getByLabelText('Name attribute'), { target: { value: 'cn' } });
		fireEvent.click(saveButton());
		await waitFor(() => expect(screen.getByText(/The server refused these settings/)).toBeInTheDocument());
		expect(screen.getByLabelText('Server URL')).toHaveAttribute('aria-invalid', 'true');
		// Once in the summary, once under the field.
		expect(screen.getAllByText(/Expected ldap:\/\/host/)).toHaveLength(2);
		expect(screen.getByLabelText('Search base')).toHaveAttribute('aria-invalid', 'true');

		// Editing the field retires its complaint.
		fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'ldaps://ok.example.com' } });
		expect(screen.getByLabelText('Server URL')).not.toHaveAttribute('aria-invalid');
	});

	test('Test connection runs on unsaved edits without saving them', async () => {
		renderOpen();
		fireEvent.change(screen.getByLabelText('Search base'), { target: { value: 'ou=staff,dc=example,dc=com' } });
		expect(testButton()).toBeEnabled();
		fireEvent.click(testButton());
		await waitFor(() => expect(testAsync).toHaveBeenCalledTimes(1));
		expect(testAsync.mock.calls[0][0].settings).toMatchObject({ searchBase: 'ou=staff,dc=example,dc=com' });
		expect(mutateAsync).not.toHaveBeenCalled();
		await waitFor(() => expect(screen.getByText(/Tested with your unsaved changes/)).toBeInTheDocument());
	});

	test('a refused test draft marks the field too (zod nests it under settings.*)', async () => {
		testAsync.mockImplementation(async () => {
			throw new LdapRequestError(
				{
					success: false,
					error: 'Validation error',
					details: [
						{ path: ['settings', 'url'], message: 'Expected ldap://host[:port] or ldaps://host[:port]' },
					],
				},
				'Failed to run the connection test'
			);
		});
		renderOpen();
		fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'http://x' } });
		fireEvent.click(testButton());
		await waitFor(() => expect(screen.getByLabelText('Server URL')).toHaveAttribute('aria-invalid', 'true'));
		expect(screen.getAllByText(/Expected ldap:\/\/host/)).toHaveLength(2);
	});

	test('with nothing changed, Test connection tests the saved settings', async () => {
		renderOpen();
		fireEvent.click(testButton());
		await waitFor(() => expect(testAsync).toHaveBeenCalledTimes(1));
		expect(testAsync.mock.calls[0][0]).not.toHaveProperty('settings');
	});

	test('an unencrypted ldap:// URL is allowed and hides the certificate settings', () => {
		settingsState.current = settings({ hasBindPassword: false });
		renderOpen();
		expect(screen.getByLabelText('CA certificate (optional)')).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'ldap://localhost:10389' } });
		expect(screen.getByText(/Passwords cross the network unencrypted/)).toBeInTheDocument();
		expect(screen.queryByLabelText('CA certificate (optional)')).not.toBeInTheDocument();
		expect(saveButton()).toBeEnabled();
	});

	test('Remove password switches the form off too, even with unsaved edits', async () => {
		mutateAsync.mockImplementation(async (updates: { bindPassword?: string | null }) => {
			if (updates.bindPassword === null) {
				settingsState.current = settings({ enabled: false, hasBindPassword: false });
			}
			return settingsState.current;
		});
		renderOpen();
		fireEvent.change(screen.getByLabelText('Name attribute'), { target: { value: 'cn' } });
		fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));
		await waitFor(() => expect(screen.getByRole('switch', { name: /LDAP login off/ })).toBeInTheDocument());
		expect(screen.queryByText(/takes effect on Save/)).not.toBeInTheDocument();
		// The unrelated edit survives, and saving it does not try to enable anything.
		expect(screen.getByLabelText('Name attribute')).toHaveValue('cn');
		expect(saveButton()).toHaveTextContent(/^Save$/);
	});

	test('the on/off switch is part of the form and saves with Save', () => {
		settingsState.current = settings({ enabled: false });
		renderOpen();
		fireEvent.click(screen.getByRole('switch', { name: /LDAP login off/ }));
		expect(screen.getByText(/takes effect on Save/)).toBeInTheDocument();
		expect(saveButton()).toHaveTextContent('Save & enable');
		fireEvent.click(saveButton());
		expect(mutateAsync.mock.calls[0][0]).toMatchObject({ enabled: true });
	});
});
