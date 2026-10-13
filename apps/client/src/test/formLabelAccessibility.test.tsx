import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { EditProfileForm } from '@/components/Profile/components/EditProfileForm/EditProfileForm';
import { OncallTeamFormDialog } from '@/components/Oncall/OncallTeamFormDialog';
import { ZabbixSetupModal } from '@/components/Integrations/ZabbixSetupModal/ZabbixSetupModal';
import * as api from '@/lib/api';
import Settings from '@/pages/Settings';
import { render, screen, waitFor } from './test-utils';

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
