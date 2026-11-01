import { beforeEach, describe, expect, test, vi } from 'vitest';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type {
	Action,
	ActionType,
	HttpActionConfig,
	JiraActionConfig,
	SlackActionConfig,
	TeamsActionConfig,
} from '@OpsiMate/shared';
import { ActionFormDialog } from '@/components/Actions/ActionFormDialog';
import type { ActionPayload } from '@/lib/api';
import { render, screen, waitFor, within } from './test-utils';

const { createMutateAsync, updateMutateAsync, testMutateAsync, toastMock } = vi.hoisted(() => ({
	createMutateAsync: vi.fn<(payload: ActionPayload) => Promise<Action>>(),
	updateMutateAsync: vi.fn<(input: { id: number; payload: ActionPayload }) => Promise<Action>>(),
	testMutateAsync: vi.fn<(payload: ActionPayload) => Promise<{ ok: boolean; message: string }>>(),
	toastMock: vi.fn(),
}));

vi.mock('@/hooks/queries/alerts', () => ({ useAlerts: () => ({ data: [] }) }));
vi.mock('@/hooks/queries/actions', () => ({
	useCreateAction: () => ({ isPending: false, mutateAsync: createMutateAsync }),
	useUpdateAction: () => ({ isPending: false, mutateAsync: updateMutateAsync }),
	useTestAction: () => ({ isPending: false, mutateAsync: testMutateAsync }),
}));
vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast: toastMock }),
	toast: toastMock,
}));

interface FieldValue {
	label: string | RegExp;
	value: string;
}

interface RequiredCase {
	typeLabel: string;
	fields: FieldValue[];
}

interface EditCase {
	name: string;
	action: Action;
	assertions: () => void;
}

const NOW = new Date('2026-01-02T03:04:05.000Z').toISOString();

const makeAction = (type: ActionType, config: Action['config'], overrides: Partial<Action> = {}): Action => ({
	id: 42,
	name: 'Existing action',
	type,
	config,
	labelMatchers: [],
	createdAt: NOW,
	updatedAt: NOW,
	...overrides,
});

const slackAction = (config: Partial<SlackActionConfig> = {}, overrides: Partial<Action> = {}) =>
	makeAction('slack', { webhookUrl: 'https://hooks.slack.com/services/T000/B000/XXX', ...config }, overrides);

const teamsAction = (config: Partial<TeamsActionConfig> = {}, overrides: Partial<Action> = {}) =>
	makeAction('teams', { webhookUrl: 'https://outlook.office.com/webhook/abc', ...config }, overrides);

const jiraAction = (config: Partial<JiraActionConfig> = {}, overrides: Partial<Action> = {}) =>
	makeAction(
		'jira',
		{
			baseUrl: 'https://example.atlassian.net',
			email: 'ops@example.com',
			apiToken: 'jira-token',
			projectKey: 'OPS',
			issueType: 'Task',
			...config,
		},
		overrides
	);

const httpAction = (config: Partial<HttpActionConfig> = {}, overrides: Partial<Action> = {}) =>
	makeAction(
		'http',
		{
			url: 'https://example.com/hook',
			method: 'POST',
			bodyFormat: 'json',
			...config,
		},
		overrides
	);

const requiredCases: RequiredCase[] = [
	{
		typeLabel: 'Slack message',
		fields: [{ label: 'Incoming webhook URL', value: 'https://hooks.slack.com/services/T000/B000/XXX' }],
	},
	{
		typeLabel: 'Microsoft Teams message',
		fields: [{ label: 'Incoming webhook URL', value: 'https://outlook.office.com/webhook/abc' }],
	},
	{
		typeLabel: 'Jira ticket',
		fields: [
			{ label: 'Jira base URL', value: 'https://example.atlassian.net' },
			{ label: 'Account email', value: 'ops@example.com' },
			{ label: 'API token', value: 'jira-token' },
			{ label: 'Project key', value: 'OPS' },
			{ label: 'Issue type', value: 'Task' },
		],
	},
	{
		typeLabel: 'HTTP request',
		fields: [{ label: /^URL/, value: 'https://example.com/hook' }],
	},
];

const switchType = async (user: UserEvent, typeLabel: string) => {
	if (typeLabel === 'Slack message') return;
	await user.click(screen.getByRole('combobox', { name: 'Type' }));
	await user.click(await screen.findByRole('option', { name: new RegExp(typeLabel) }));
};

const fillRequiredFields = async (user: UserEvent, testCase: RequiredCase) => {
	await user.type(screen.getByLabelText('Name'), 'Notify');
	await switchType(user, testCase.typeLabel);
	for (const field of testCase.fields) {
		const input = screen.getByLabelText(field.label);
		await user.clear(input);
		await user.type(input, field.value);
	}
};

const actionButtons = (isEdit = false) => ({
	submit: screen.getByRole('button', { name: isEdit ? 'Save changes' : 'Create action' }),
	sendTest: screen.getByRole('button', { name: 'Send test' }),
});

const renderValidSlack = () => {
	render(<ActionFormDialog open onOpenChange={vi.fn()} action={slackAction()} />);
};

beforeEach(() => {
	createMutateAsync.mockReset();
	updateMutateAsync.mockReset();
	testMutateAsync.mockReset();
	toastMock.mockReset();
	window.HTMLElement.prototype.scrollIntoView = vi.fn();
	window.HTMLElement.prototype.hasPointerCapture = vi.fn();
	window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

describe('ActionFormDialog: required fields', () => {
	test.each(requiredCases)(
		'$typeLabel enables save/test only while its required fields are filled',
		async (testCase) => {
			const user = userEvent.setup();
			render(<ActionFormDialog open onOpenChange={vi.fn()} />);

			await fillRequiredFields(user, testCase);
			expect(actionButtons().submit).toBeEnabled();
			expect(actionButtons().sendTest).toBeEnabled();

			for (const field of [...testCase.fields, { label: 'Name', value: 'Notify' }]) {
				const input = screen.getByLabelText(field.label);
				await user.clear(input);
				expect(actionButtons().submit).toBeDisabled();
				expect(actionButtons().sendTest).toBeDisabled();
				await user.type(input, field.value);
				expect(actionButtons().submit).toBeEnabled();
				expect(actionButtons().sendTest).toBeEnabled();
			}
		}
	);
});

describe('ActionFormDialog: exact create payloads', () => {
	test('trims the Slack fields and sends empty optional values as null', async () => {
		const user = userEvent.setup();
		createMutateAsync.mockResolvedValue(slackAction());
		render(<ActionFormDialog open onOpenChange={vi.fn()} />);

		await user.type(screen.getByLabelText('Name'), '  Notify  ');
		await user.type(screen.getByLabelText('Incoming webhook URL'), '  https://hooks.slack.com/x  ');
		await user.type(screen.getByLabelText('Channel override (optional)'), '  #ops  ');
		await user.click(screen.getByLabelText('Message template (optional)'));
		await user.paste('  {{name}} fired  ');
		await user.click(actionButtons().submit);

		await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
		expect(createMutateAsync.mock.calls[0][0]).toEqual({
			name: 'Notify',
			type: 'slack',
			nameContainsAny: null,
			labelMatchers: [],
			labelMatcherGroups: [],
			config: {
				webhookUrl: 'https://hooks.slack.com/x',
				channel: '#ops',
				messageTemplate: '{{name}} fired',
			},
		});
	});

	test('trims the Teams fields and sends empty optional values as null', async () => {
		const user = userEvent.setup();
		createMutateAsync.mockResolvedValue(teamsAction());
		render(<ActionFormDialog open onOpenChange={vi.fn()} />);

		await user.type(screen.getByLabelText('Name'), '  Page Teams  ');
		await switchType(user, 'Microsoft Teams message');
		await user.type(screen.getByLabelText('Incoming webhook URL'), '  https://outlook.office.com/webhook/x  ');
		await user.click(screen.getByLabelText('Card title (optional)'));
		await user.paste('  {{name}}  ');
		await user.click(actionButtons().submit);

		await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
		expect(createMutateAsync.mock.calls[0][0]).toEqual({
			name: 'Page Teams',
			type: 'teams',
			nameContainsAny: null,
			labelMatchers: [],
			labelMatcherGroups: [],
			config: {
				webhookUrl: 'https://outlook.office.com/webhook/x',
				titleTemplate: '{{name}}',
				messageTemplate: null,
			},
		});
	});

	test('trims every Jira field and sends only the Jira config', async () => {
		const user = userEvent.setup();
		createMutateAsync.mockResolvedValue(jiraAction());
		render(<ActionFormDialog open onOpenChange={vi.fn()} />);

		await user.type(screen.getByLabelText('Name'), '  Open Jira  ');
		await switchType(user, 'Jira ticket');
		await user.type(screen.getByLabelText('Jira base URL'), '  https://example.atlassian.net  ');
		await user.type(screen.getByLabelText('Account email'), '  ops@example.com  ');
		await user.type(screen.getByLabelText('API token'), '  jira-token  ');
		await user.type(screen.getByLabelText('Project key'), '  OPS  ');
		await user.clear(screen.getByLabelText('Issue type'));
		await user.type(screen.getByLabelText('Issue type'), '  Incident  ');
		await user.click(screen.getByLabelText('Summary template (optional)'));
		await user.paste('  {{name}}  ');
		await user.click(actionButtons().submit);

		await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
		expect(createMutateAsync.mock.calls[0][0]).toEqual({
			name: 'Open Jira',
			type: 'jira',
			nameContainsAny: null,
			labelMatchers: [],
			labelMatcherGroups: [],
			config: {
				baseUrl: 'https://example.atlassian.net',
				email: 'ops@example.com',
				apiToken: 'jira-token',
				projectKey: 'OPS',
				issueType: 'Incident',
				summaryTemplate: '{{name}}',
				descriptionTemplate: null,
			},
		});
	});

	test('trims the HTTP URL and keeps the default JSON body settings', async () => {
		const user = userEvent.setup();
		createMutateAsync.mockResolvedValue(httpAction());
		render(<ActionFormDialog open onOpenChange={vi.fn()} />);

		await user.type(screen.getByLabelText('Name'), '  Call webhook  ');
		await switchType(user, 'HTTP request');
		await user.type(screen.getByLabelText(/^URL/), '  https://example.com/hook  ');
		await user.click(actionButtons().submit);

		await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
		expect(createMutateAsync.mock.calls[0][0]).toEqual({
			name: 'Call webhook',
			type: 'http',
			nameContainsAny: null,
			labelMatchers: [],
			labelMatcherGroups: [],
			config: {
				url: 'https://example.com/hook',
				method: 'POST',
				headers: null,
				bodyTemplate: null,
				bodyFormat: 'json',
				editableFields: null,
				fireAndForget: false,
			},
		});
	});
});

describe('ActionFormDialog: HTTP headers', () => {
	test('trims header names, keeps values as typed, and drops blank rows', async () => {
		const user = userEvent.setup();
		createMutateAsync.mockResolvedValue(httpAction());
		render(<ActionFormDialog open onOpenChange={vi.fn()} />);

		await user.type(screen.getByLabelText('Name'), 'Notify');
		await switchType(user, 'HTTP request');
		await user.type(screen.getByLabelText(/^URL/), 'https://example.com/hook');
		const addHeader = () =>
			user.click(
				within(screen.getByText('Headers').parentElement as HTMLElement).getByRole('button', { name: 'Add' })
			);
		await addHeader();
		await addHeader();
		await addHeader();
		await user.type(screen.getByLabelText('Header 1 name'), '  X-Token  ');
		await user.type(screen.getByLabelText('Header 1 value'), ' abc ');
		await user.type(screen.getByLabelText('Header 2 value'), 'dropped');
		await user.click(actionButtons().submit);

		await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
		expect((createMutateAsync.mock.calls[0][0].config as HttpActionConfig).headers).toEqual({ 'X-Token': ' abc ' });
	});

	test('sends headers as null when every row is blank', async () => {
		const user = userEvent.setup();
		createMutateAsync.mockResolvedValue(httpAction());
		render(<ActionFormDialog open onOpenChange={vi.fn()} />);

		await user.type(screen.getByLabelText('Name'), 'Notify');
		await switchType(user, 'HTTP request');
		await user.type(screen.getByLabelText(/^URL/), 'https://example.com/hook');
		await user.click(
			within(screen.getByText('Headers').parentElement as HTMLElement).getByRole('button', { name: 'Add' })
		);
		await user.click(actionButtons().submit);

		await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
		expect((createMutateAsync.mock.calls[0][0].config as HttpActionConfig).headers).toBeNull();
	});
});

describe('ActionFormDialog: loading and reset', () => {
	const editCases: EditCase[] = [
		{
			name: 'Slack',
			action: slackAction({
				webhookUrl: 'https://hooks.slack.com/edit',
				channel: '#alerts',
				messageTemplate: '{{name}} fired',
			}),
			assertions: () => {
				expect(screen.getByLabelText('Incoming webhook URL')).toHaveValue('https://hooks.slack.com/edit');
				expect(screen.getByLabelText('Channel override (optional)')).toHaveValue('#alerts');
				expect(screen.getByLabelText('Message template (optional)')).toHaveValue('{{name}} fired');
			},
		},
		{
			name: 'Teams',
			action: teamsAction({
				webhookUrl: 'https://outlook.office.com/webhook/edit',
				titleTemplate: '{{severity}}',
				messageTemplate: '{{summary}}',
			}),
			assertions: () => {
				expect(screen.getByLabelText('Incoming webhook URL')).toHaveValue(
					'https://outlook.office.com/webhook/edit'
				);
				expect(screen.getByLabelText('Card title (optional)')).toHaveValue('{{severity}}');
				expect(screen.getByLabelText('Message template (optional)')).toHaveValue('{{summary}}');
			},
		},
		{
			name: 'Jira',
			action: jiraAction({
				issueType: 'Incident',
				summaryTemplate: '{{name}}',
				descriptionTemplate: '{{summary}}',
			}),
			assertions: () => {
				expect(screen.getByLabelText('Jira base URL')).toHaveValue('https://example.atlassian.net');
				expect(screen.getByLabelText('Account email')).toHaveValue('ops@example.com');
				expect(screen.getByLabelText('API token')).toHaveValue('jira-token');
				expect(screen.getByLabelText('Project key')).toHaveValue('OPS');
				expect(screen.getByLabelText('Issue type')).toHaveValue('Incident');
				expect(screen.getByLabelText('Summary template (optional)')).toHaveValue('{{name}}');
				expect(screen.getByLabelText('Description template (optional)')).toHaveValue('{{summary}}');
			},
		},
		{
			name: 'HTTP',
			action: httpAction({
				url: 'https://example.com/edit',
				method: 'PUT',
				headers: { 'X-Token': 'abc' },
				bodyTemplate: '{"text":"{{name}}"}',
				bodyFormat: 'json',
			}),
			assertions: () => {
				expect(screen.getByLabelText(/^URL/)).toHaveValue('https://example.com/edit');
				expect(screen.getByRole('combobox', { name: 'Method' })).toHaveTextContent('PUT');
				expect(screen.getByLabelText('Header 1 name')).toHaveValue('X-Token');
				expect(screen.getByLabelText('Header 1 value')).toHaveValue('abc');
				expect(screen.getByLabelText('Request body template (optional)')).toHaveValue('{"text":"{{name}}"}');
				expect(screen.getByRole('checkbox', { name: 'Body is JSON' })).toHaveAttribute('aria-checked', 'true');
			},
		},
	];

	test.each(editCases)('editing a $name action loads its own config', ({ action, assertions }) => {
		render(<ActionFormDialog open onOpenChange={vi.fn()} action={action} />);
		expect(screen.getByText('Edit action')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
		assertions();
	});

	test('New after Edit is empty and back on the Slack defaults', async () => {
		const { rerender } = render(<ActionFormDialog open onOpenChange={vi.fn()} action={jiraAction()} />);
		rerender(<ActionFormDialog open={false} onOpenChange={vi.fn()} action={jiraAction()} />);
		rerender(<ActionFormDialog open onOpenChange={vi.fn()} action={null} />);

		expect(screen.getByText('New action')).toBeInTheDocument();
		expect(screen.getByLabelText('Name')).toHaveValue('');
		expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Slack message');
		expect(screen.getByLabelText('Incoming webhook URL')).toHaveValue('');
		expect(screen.getByLabelText('Channel override (optional)')).toHaveValue('');
		expect(screen.getByLabelText('Message template (optional)')).toHaveValue('');
		expect(screen.getByLabelText('Alert name contains')).toHaveValue('');
	});

	test('legacy name and label matchers load as the new list and group shapes', async () => {
		const user = userEvent.setup();
		const legacyAction = slackAction(
			{ webhookUrl: 'https://hooks.slack.com/legacy' },
			{ labelMatchers: [{ key: 'env', value: 'prod' }], nameContains: 'cpu' }
		);
		updateMutateAsync.mockResolvedValue(legacyAction);
		render(<ActionFormDialog open onOpenChange={vi.fn()} action={legacyAction} />);

		expect(screen.getByLabelText('Alert name contains')).toHaveValue('cpu');
		expect(screen.getByLabelText('Matcher key')).toHaveValue('env');
		expect(screen.getByLabelText('Matcher value')).toHaveValue('prod');
		await user.click(actionButtons(true).submit);

		await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
		expect(updateMutateAsync.mock.calls[0][0]).toEqual({
			id: legacyAction.id,
			payload: {
				name: 'Existing action',
				type: 'slack',
				nameContainsAny: ['cpu'],
				labelMatchers: [{ key: 'env', value: 'prod' }],
				labelMatcherGroups: [[{ key: 'env', value: 'prod' }]],
				config: {
					webhookUrl: 'https://hooks.slack.com/legacy',
					channel: null,
					messageTemplate: null,
				},
			},
		});
	});
});

describe('ActionFormDialog: save and test results', () => {
	test('a successful create toasts and closes', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		createMutateAsync.mockResolvedValue(slackAction());
		render(<ActionFormDialog open onOpenChange={onOpenChange} />);
		await fillRequiredFields(user, requiredCases[0]);

		await user.click(actionButtons().submit);
		await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'Action created', description: 'Notify' }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	test('a successful update toasts and closes', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		updateMutateAsync.mockResolvedValue(slackAction());
		render(<ActionFormDialog open onOpenChange={onOpenChange} action={slackAction()} />);

		await user.click(actionButtons(true).submit);
		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith({ title: 'Action updated', description: 'Existing action' })
		);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	test('a failed save shows the destructive error toast and stays open', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		createMutateAsync.mockRejectedValue(new Error('boom'));
		render(<ActionFormDialog open onOpenChange={onOpenChange} />);
		await fillRequiredFields(user, requiredCases[0]);

		await user.click(actionButtons().submit);
		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith({
				title: 'Failed to create action',
				description: 'boom',
				variant: 'destructive',
			})
		);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	test('a successful test sends the same payload and reports its message', async () => {
		const user = userEvent.setup();
		testMutateAsync.mockResolvedValue({ ok: true, message: 'Posted' });
		renderValidSlack();

		await user.click(actionButtons(true).sendTest);
		await waitFor(() => expect(testMutateAsync).toHaveBeenCalledTimes(1));
		expect(testMutateAsync.mock.calls[0][0]).toEqual({
			name: 'Existing action',
			type: 'slack',
			nameContainsAny: null,
			labelMatchers: [],
			labelMatcherGroups: [],
			config: {
				webhookUrl: 'https://hooks.slack.com/services/T000/B000/XXX',
				channel: null,
				messageTemplate: null,
			},
		});
		expect(toastMock).toHaveBeenCalledWith({ title: 'Test succeeded', description: 'Posted', variant: undefined });
	});

	test('a failed test result and a thrown test error stay destructive', async () => {
		const user = userEvent.setup();
		testMutateAsync
			.mockResolvedValueOnce({ ok: false, message: 'HTTP 500' })
			.mockRejectedValueOnce(new Error('down'));
		renderValidSlack();

		await user.click(actionButtons(true).sendTest);
		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith({
				title: 'Test failed',
				description: 'HTTP 500',
				variant: 'destructive',
			})
		);
		await user.click(actionButtons(true).sendTest);
		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith({
				title: 'Test failed',
				description: 'down',
				variant: 'destructive',
			})
		);
	});

	test('Cancel closes without creating or testing', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		render(<ActionFormDialog open onOpenChange={onOpenChange} />);

		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(createMutateAsync).not.toHaveBeenCalled();
		expect(testMutateAsync).not.toHaveBeenCalled();
	});
});
