import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Role, SecretType, type SecretMetadata } from '@OpsiMate/shared';
import { AddUserModal } from '@/components/AddUserModal';
import { EditSecretDialog } from '@/components/EditSecretDialog';
import { EditProfileForm } from '@/components/Profile/components/EditProfileForm/EditProfileForm';
import { OncallTeamFormDialog } from '@/components/Oncall/OncallTeamFormDialog';
import { ZabbixSetupModal } from '@/components/Integrations/ZabbixSetupModal/ZabbixSetupModal';
import * as api from '@/lib/api';
import Settings, { AddSecretButton } from '@/pages/Settings';
import type { User } from '@/types';
import { render, screen, waitFor, within } from './test-utils';

const profileLabels = ['New Password', 'Confirm Password'];
const teamLabels = ['Team name', 'Rotate every (days)'];
const zabbixLabels = [
	'Media Type Name',
	'Zabbix Server URL',
	'OpsiMate Webhook URL',
	'Zabbix Username',
	'Zabbix Password',
];

const renderProfile = (isDirectoryAccount = false, isEditing = true) => (
	<EditProfileForm
		isEditing={isEditing}
		isDirectoryAccount={isDirectoryAccount}
		saving={false}
		formData={{ fullName: 'Test User', phoneNumber: '', newPassword: '', confirmPassword: '' }}
		errors={{}}
		onFormDataChange={vi.fn()}
		onSave={vi.fn()}
		onCancel={vi.fn()}
		onEdit={vi.fn()}
	/>
);

const renderTeam = (open = true) => (
	<OncallTeamFormDialog open={open} team={null} users={[]} saving={false} onClose={vi.fn()} onSave={vi.fn()} />
);

const renderZabbix = (open = true) => <ZabbixSetupModal open={open} onOpenChange={vi.fn()} />;

const forms = [
	{ name: 'profile password', component: renderProfile, labels: profileLabels },
	{ name: 'on-call team', component: renderTeam, labels: teamLabels },
	{ name: 'Zabbix setup', component: renderZabbix, labels: zabbixLabels },
];

describe.each(forms)('$name form labels', ({ component, labels }) => {
	test('finds every input by its visible label and focuses it when the label is clicked', async () => {
		const user = userEvent.setup();
		render(component());

		for (const label of labels) {
			const input = screen.getByLabelText(label);
			expect(input.tagName).toBe('INPUT');
			expect(input).toHaveAccessibleName(label);
			await user.click(screen.getByText(label, { selector: 'label' }));
			expect(input).toHaveFocus();
		}
	});

	test('keeps label associations unique across two mounted copies', () => {
		render(
			<>
				{component()}
				{component()}
			</>
		);

		const ids: string[] = [];
		for (const label of labels) {
			const inputs = screen.getAllByLabelText(label);
			expect(inputs).toHaveLength(2);
			for (const input of inputs) {
				expect(input.id).not.toBe('');
				expect(input).toHaveAccessibleName(label);
				ids.push(input.id);
			}
		}
		expect(new Set(ids).size).toBe(ids.length);
	});
});

test('names the actual members list with text instead of a form label, using unique IDs', () => {
	const { rerender } = render(renderTeam());
	expect(screen.getByRole('list', { name: 'Members (call order)' }).tagName).toBe('UL');

	rerender(
		<>
			{renderTeam()}
			{renderTeam()}
		</>
	);

	const lists = screen.getAllByLabelText('Members (call order)', { selector: 'ul' });
	expect(lists).toHaveLength(2);
	const ids = lists.map((list) => {
		expect(list.tagName).toBe('UL');
		const id = list.getAttribute('aria-labelledby');
		expect(id).toBeTruthy();
		const text = document.getElementById(id!);
		expect(text).toHaveTextContent('Members (call order)');
		expect(text?.tagName).not.toBe('LABEL');
		return id;
	});
	expect(ids[0]).not.toBe(ids[1]);
});

test('preserves the hidden password fields for directory accounts and non-editing profiles', () => {
	const { rerender } = render(renderProfile(false, false));
	expect(screen.getByRole('button', { name: 'Edit Profile' })).toBeInTheDocument();
	for (const label of profileLabels) expect(screen.queryByLabelText(label)).not.toBeInTheDocument();

	rerender(renderProfile(true));
	expect(screen.getByText(/Your password is managed by your organization's directory/)).toBeInTheDocument();
	for (const label of profileLabels) expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
});

test('keeps the labelled inputs out of closed dialogs', () => {
	render(
		<>
			{renderTeam(false)}
			{renderZabbix(false)}
		</>
	);
	for (const label of [...teamLabels, ...zabbixLabels]) {
		expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
	}
});

describe('Add User role label', () => {
	const renderAddUser = () => <AddUserModal isOpen onClose={vi.fn()} onUserCreated={vi.fn()} />;

	test('connects the Add User role dropdown to its visible label', () => {
		render(renderAddUser());
		const select = screen.getByRole('combobox', { name: 'Role' });
		expect(screen.getByLabelText('Role')).toBe(select);
		expect(select).toHaveAccessibleName('Role');
	});

	test('keeps role label associations unique across two mounted Add User dialogs', () => {
		render(
			<>
				{renderAddUser()}
				{renderAddUser()}
			</>
		);

		const selects = screen.getAllByLabelText('Role');
		expect(selects).toHaveLength(2);
		for (const select of selects) {
			expect(select.id).not.toBe('');
			expect(select).toHaveAttribute('role', 'combobox');
			expect(select).toHaveAccessibleName('Role');
		}
		expect(selects[0].id).not.toBe(selects[1].id);
	});
});

describe('secret type labels', () => {
	const secret: SecretMetadata = {
		id: 1,
		name: 'Test SSH key',
		fileName: 'test-key.pem',
		type: SecretType.SSH,
	};

	test('connects the Edit Secret type dropdown to its visible label', () => {
		render(<EditSecretDialog secret={secret} open onClose={vi.fn()} onSuccess={vi.fn()} />);
		const select = screen.getByRole('combobox', { name: 'Type' });
		expect(screen.getByLabelText('Type')).toBe(select);
		expect(select).toHaveAccessibleName('Type');
	});

	test('connects the Add Secret type dropdown to its visible label', async () => {
		const user = userEvent.setup();
		render(<AddSecretButton />);
		await user.click(screen.getByRole('button', { name: 'Add Secret' }));

		const select = screen.getByRole('combobox', { name: 'Type' });
		expect(screen.getByLabelText('Type')).toBe(select);
		expect(select).toHaveAccessibleName('Type');
	});

	test('keeps type label associations unique across mounted Add and Edit Secret dialogs', async () => {
		const user = userEvent.setup();
		const { rerender } = render(<AddSecretButton />);
		await user.click(screen.getByRole('button', { name: 'Add Secret' }));
		rerender(
			<>
				<AddSecretButton />
				<EditSecretDialog secret={secret} open onClose={vi.fn()} onSuccess={vi.fn()} />
			</>
		);

		const selects = screen.getAllByLabelText('Type');
		expect(selects).toHaveLength(2);
		for (const select of selects) {
			expect(select.id).not.toBe('');
			expect(select).toHaveAccessibleName('Type');
		}
		expect(selects[0].id).not.toBe(selects[1].id);
	});
});

describe('Settings user role labels', () => {
	let originalHash: string;

	beforeEach(() => {
		originalHash = window.location.hash;
		window.location.hash = '';
	});

	afterEach(() => {
		window.location.hash = originalHash;
		vi.restoreAllMocks();
	});

	test('names each user role dropdown and the bulk role dropdown', async () => {
		const users: User[] = [
			{ id: 1, email: 'alice@example.com', fullName: 'Alice', role: Role.Viewer, createdAt: '2026-01-01' },
			{ id: 2, email: 'bob@example.com', fullName: 'Bob', role: Role.Editor, createdAt: '2026-01-01' },
		];
		vi.spyOn(api, 'apiRequest').mockImplementation(async (path) => ({
			success: true,
			data: path === '/users' ? users : [],
		}));
		const user = userEvent.setup();
		render(<Settings />);

		await screen.findByRole('row', { name: /alice@example.com/ });
		for (const account of users) {
			const row = screen.getByRole('row', { name: new RegExp(account.email) });
			const select = screen.getByRole('combobox', { name: `Role for ${account.email}` });
			expect(within(row).getByRole('combobox')).toBe(select);
		}

		expect(screen.queryByRole('combobox', { name: /selected users/i })).not.toBeInTheDocument();
		await user.click(within(screen.getByRole('row', { name: /alice@example.com/ })).getByRole('checkbox'));
		expect(screen.getByRole('combobox', { name: /selected users/i })).toHaveAccessibleName(
			'Change role of selected users'
		);
	});
});

describe('audit page-size label', () => {
	let originalHash: string;

	beforeEach(() => {
		originalHash = window.location.hash;
		vi.spyOn(api, 'apiRequest').mockResolvedValue({ success: true, data: [] });
		vi.spyOn(api.auditApi, 'getAuditLogs').mockResolvedValue({ success: true, data: { logs: [], total: 0 } });
	});

	afterEach(() => {
		window.location.hash = originalHash;
		vi.restoreAllMocks();
	});

	test('finds and focuses the real Settings select by its label and changes the page size', async () => {
		const user = userEvent.setup();
		render(<Settings />);
		await user.click(await screen.findByRole('tab', { name: 'Audit Log' }));

		const select = screen.getByLabelText('Items per page:');
		expect(select).toBe(screen.getByRole('combobox', { name: 'Items per page:' }));
		await user.click(screen.getByText('Items per page:', { selector: 'label' }));
		expect(select).toHaveFocus();
		await user.selectOptions(select, '20');
		expect(select).toHaveValue('20');
		await waitFor(() => expect(api.auditApi.getAuditLogs).toHaveBeenCalledWith(1, 20));
	});

	test('keeps the select ID unique across two Settings pages', async () => {
		const user = userEvent.setup();
		render(
			<>
				<Settings />
				<Settings />
			</>
		);
		for (const tab of await screen.findAllByRole('tab', { name: 'Audit Log' })) {
			await user.click(tab);
		}
		const selects = screen.getAllByLabelText('Items per page:');
		expect(selects).toHaveLength(2);
		expect(selects[0].id).not.toBe('');
		expect(selects[1].id).not.toBe('');
		expect(selects[0].id).not.toBe(selects[1].id);
	});
});
