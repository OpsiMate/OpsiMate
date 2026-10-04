import { LdapSettings } from '@/components/Settings/LdapSettings';
import { LdapSettings as LdapSettingsData } from '@OpsiMate/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AllTheProviders } from './TestProviders';

// The query hooks are mocked at the module boundary: this test is about what the form
// lets an admin do, not about fetching.
const { mutateAsync, settingsState, pendingState } = vi.hoisted(() => ({
	mutateAsync: vi.fn(),
	settingsState: { current: null as LdapSettingsData | null },
	pendingState: { save: false, test: false },
}));
vi.mock('@/hooks/queries/ldap', () => ({
	useLdapSettings: () => ({ data: settingsState.current, isLoading: false, error: null }),
	useUpdateLdapSettings: () => ({ mutateAsync, mutate: vi.fn(), isPending: pendingState.save }),
	useTestLdapConnection: () => ({ mutateAsync: vi.fn(), isPending: pendingState.test }),
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

const saveButton = () => screen.getByRole('button', { name: /^save$/i });

beforeEach(() => {
	mutateAsync.mockReset();
	mutateAsync.mockImplementation(async () => settingsState.current);
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
		expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
	});

	test.each(['save', 'test'] as const)('the form is frozen while a %s is in flight', (which) => {
		pendingState[which] = true;
		renderOpen();
		expect(screen.getByLabelText('Server URL')).toBeDisabled();
		expect(screen.getByLabelText('Password')).toBeDisabled();
		expect(screen.getByLabelText('Admin groups')).toBeDisabled();
		expect(screen.getByRole('button', { name: /test connection/i })).toBeDisabled();
	});
});
