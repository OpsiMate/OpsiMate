import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
	AlertSeverity,
	AlertStatus,
	type Action,
	type ActionOverrides,
	type ActionPreview,
	type ActionTestResult,
	type ActionType,
	type Alert,
} from '@OpsiMate/shared';
import { ActionSendDialog } from '@/components/Alerts/AlertDetails/AlertActionsSection/ActionSendDialog';
import { fireEvent, render, screen, waitFor } from './test-utils';

interface PreviewInput {
	id: number;
	alert: Alert;
}

interface RunInput extends PreviewInput {
	overrides: ActionOverrides;
}

interface ToastInput {
	title: string;
	description?: string;
	variant?: string;
}

const { previewMutateAsync, runMutateAsync, toastMock } = vi.hoisted(() => ({
	previewMutateAsync: vi.fn<(input: PreviewInput) => Promise<ActionPreview>>(),
	runMutateAsync: vi.fn<(input: RunInput) => Promise<ActionTestResult>>(),
	toastMock: vi.fn<(input: ToastInput) => void>(),
}));

vi.mock('@/hooks/queries/actions', () => ({
	usePreviewAction: () => ({ isPending: false, mutateAsync: previewMutateAsync }),
	useRunAction: () => ({ isPending: false, mutateAsync: runMutateAsync }),
}));

vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast: toastMock }),
}));

const NOW = new Date('2026-01-02T03:04:05.000Z').toISOString();

const alert: Alert = {
	id: 'disk-full',
	alertName: 'Disk full',
	type: 'Custom',
	status: AlertStatus.FIRING,
	severity: AlertSeverity.CRITICAL,
	tags: { environment: 'production' },
	startsAt: NOW,
	updatedAt: NOW,
	createdAt: NOW,
	alertUrl: '',
	isSilenced: false,
};

const makeAction = (type: ActionType, config: Action['config']): Action => ({
	id: 7,
	name: 'Notify on-call',
	type,
	config,
	labelMatchers: [],
	createdAt: NOW,
	updatedAt: NOW,
});

const actions = {
	slack: makeAction('slack', {
		webhookUrl: 'https://hooks.slack.com/services/T000/B000/secret',
		channel: '#ops',
	}),
	teams: makeAction('teams', { webhookUrl: 'https://teams.example.com/webhook/secret' }),
	jira: makeAction('jira', {
		baseUrl: 'https://jira.example.com',
		email: 'ops@example.com',
		apiToken: 'jira-token',
		projectKey: 'OPS',
		issueType: 'Bug',
	}),
	http: makeAction('http', { url: 'https://example.com/hooks/deploy?source=opsimate', method: 'POST' }),
} satisfies Record<ActionType, Action>;

const previews = {
	slack: {
		type: 'slack',
		message: 'Disk is full',
		channel: '#ops',
		webhookUrl: 'https://hooks.slack.com/services/T000/B000/secret',
	},
	teams: {
		type: 'teams',
		title: 'Disk alert',
		message: 'Disk is full',
		webhookUrl: 'https://teams.example.com/webhook/secret',
	},
	jira: {
		type: 'jira',
		summary: 'Disk full on server',
		description: 'Investigate now',
		baseUrl: 'https://jira.example.com/browse/OPS-1',
		projectKey: 'OPS',
		issueType: 'Bug',
	},
	http: {
		type: 'http',
		method: 'POST',
		url: 'https://example.com/hooks/deploy?source=opsimate',
		body: '{"text":"Disk full"}',
	},
} satisfies Record<ActionType, ActionPreview>;

interface RenderDialogOptions {
	open?: boolean;
	action?: Action;
	onOpenChange?: (open: boolean) => void;
}

const renderDialog = ({ open = true, action = actions.http, onOpenChange = vi.fn() }: RenderDialogOptions = {}) =>
	render(<ActionSendDialog open={open} onOpenChange={onOpenChange} action={action} alert={alert} />);

interface FieldValue {
	label: string;
	value: string;
}

interface PreviewCase {
	type: ActionType;
	visible: FieldValue[];
	hidden: string[];
}

const ALL_FIELD_LABELS = ['Message', 'Title', 'Summary', 'Description', 'Request body'];

const previewCases: PreviewCase[] = [
	{
		type: 'slack',
		visible: [{ label: 'Message', value: 'Disk is full' }],
		hidden: ['Title', 'Summary', 'Description', 'Request body'],
	},
	{
		type: 'teams',
		visible: [
			{ label: 'Title', value: 'Disk alert' },
			{ label: 'Message', value: 'Disk is full' },
		],
		hidden: ['Summary', 'Description', 'Request body'],
	},
	{
		type: 'jira',
		visible: [
			{ label: 'Summary', value: 'Disk full on server' },
			{ label: 'Description', value: 'Investigate now' },
		],
		hidden: ['Message', 'Title', 'Request body'],
	},
	{
		type: 'http',
		visible: [{ label: 'Request body', value: '{"text":"Disk full"}' }],
		hidden: ['Message', 'Title', 'Summary', 'Description'],
	},
];

describe('ActionSendDialog: preview', () => {
	test.each(previewCases)('prefills only the $type fields', async ({ type, visible, hidden }) => {
		previewMutateAsync.mockResolvedValue(previews[type]);
		renderDialog({ action: actions[type] });

		for (const field of visible) {
			expect(await screen.findByLabelText(field.label)).toHaveValue(field.value);
		}
		for (const label of hidden) {
			expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
		}
		expect(previewMutateAsync).toHaveBeenCalledTimes(1);
		expect(previewMutateAsync).toHaveBeenCalledWith({ id: actions[type].id, alert });
	});

	test('does not fetch a preview while closed', () => {
		renderDialog({ open: false, action: actions.slack });
		expect(previewMutateAsync).not.toHaveBeenCalled();
	});
});

interface DestinationCase {
	name: string;
	preview: ActionPreview;
	expected: string;
}

const destinationCases: DestinationCase[] = [
	{
		name: 'Slack shows its channel and webhook host only',
		preview: previews.slack,
		expected: 'Slack · #ops (hooks.slack.com)',
	},
	{
		name: 'Teams shows its webhook host only',
		preview: previews.teams,
		expected: 'Microsoft Teams (teams.example.com)',
	},
	{
		name: 'Jira shows its project and host only',
		preview: previews.jira,
		expected: 'OPS · Bug (jira.example.com)',
	},
	{
		name: 'HTTP shows the method and full URL',
		preview: previews.http,
		expected: 'POST https://example.com/hooks/deploy?source=opsimate',
	},
	{
		name: 'an invalid webhook URL is shown unchanged',
		preview: { ...previews.slack, channel: null, webhookUrl: 'not a valid webhook' },
		expected: 'Slack (not a valid webhook)',
	},
];

describe('ActionSendDialog: destination', () => {
	test.each(destinationCases)('$name', async ({ preview, expected }) => {
		previewMutateAsync.mockResolvedValue(preview);
		renderDialog({ action: actions[preview.type] });

		expect(await screen.findByText(expected)).toBeInTheDocument();
		if (preview.type !== 'http') {
			expect(document.body).not.toHaveTextContent('secret');
		}
	});

	test('omits the Slack channel separator when there is no channel', async () => {
		previewMutateAsync.mockResolvedValue({ ...previews.slack, channel: null });
		renderDialog({ action: actions.slack });

		expect(await screen.findByText('Slack (hooks.slack.com)')).toBeInTheDocument();
		expect(screen.queryByText(/Slack ·/)).not.toBeInTheDocument();
	});
});

interface OverrideCase {
	type: ActionType;
	edits: FieldValue[];
	expected: ActionOverrides;
}

const overrideCases: OverrideCase[] = [
	{
		type: 'slack',
		edits: [{ label: 'Message', value: 'Edited Slack message' }],
		expected: { message: 'Edited Slack message' },
	},
	{
		type: 'teams',
		edits: [
			{ label: 'Title', value: 'Edited Teams title' },
			{ label: 'Message', value: 'Edited Teams message' },
		],
		expected: { title: 'Edited Teams title', message: 'Edited Teams message' },
	},
	{
		type: 'jira',
		edits: [
			{ label: 'Summary', value: 'Edited Jira summary' },
			{ label: 'Description', value: 'Edited Jira description' },
		],
		expected: { summary: 'Edited Jira summary', description: 'Edited Jira description' },
	},
	{
		type: 'http',
		edits: [{ label: 'Request body', value: '{"text":"Edited"}' }],
		expected: { body: '{"text":"Edited"}' },
	},
];

describe('ActionSendDialog: overrides', () => {
	test.each(overrideCases)('sends only edited $type fields', async ({ type, edits, expected }) => {
		previewMutateAsync.mockResolvedValue(previews[type]);
		runMutateAsync.mockResolvedValue({ ok: true, message: 'Posted' });
		renderDialog({ action: actions[type] });

		expect(await screen.findByLabelText(edits[0].label)).toBeInTheDocument();
		for (const edit of edits) {
			fireEvent.change(screen.getByLabelText(edit.label), { target: { value: edit.value } });
		}
		fireEvent.click(screen.getByRole('button', { name: 'Send' }));

		await waitFor(() => expect(runMutateAsync).toHaveBeenCalledTimes(1));
		expect(runMutateAsync).toHaveBeenCalledWith({ id: actions[type].id, alert, overrides: expected });
	});
});

interface PreviewErrorCase {
	reason: unknown;
	expected: string;
}

const previewErrorCases: PreviewErrorCase[] = [
	{ reason: new Error('template broke'), expected: 'template broke' },
	{ reason: 'boom', expected: 'Failed to build preview' },
];

describe('ActionSendDialog: preview errors', () => {
	test.each(previewErrorCases)('shows $expected and disables Send', async ({ reason, expected }) => {
		previewMutateAsync.mockRejectedValue(reason);
		renderDialog({ action: actions.slack });

		expect(await screen.findByText(expected)).toBeInTheDocument();
		for (const label of ALL_FIELD_LABELS) {
			expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
		}
		expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
	});
});

describe('ActionSendDialog: run result', () => {
	test('shows a success toast and closes after a successful run', async () => {
		const onOpenChange = vi.fn();
		previewMutateAsync.mockResolvedValue(previews.slack);
		runMutateAsync.mockResolvedValue({ ok: true, message: 'Posted' });
		renderDialog({ action: actions.slack, onOpenChange });

		fireEvent.click(await screen.findByRole('button', { name: 'Send' }));

		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith({
				title: 'Notify on-call sent',
				description: 'Posted',
				variant: undefined,
			})
		);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	test('keeps the dialog and edited text after a failed result', async () => {
		const onOpenChange = vi.fn();
		previewMutateAsync.mockResolvedValue(previews.slack);
		runMutateAsync.mockResolvedValue({ ok: false, message: 'HTTP 500' });
		renderDialog({ action: actions.slack, onOpenChange });

		const message = await screen.findByLabelText('Message');
		fireEvent.change(message, { target: { value: 'Keep this edit' } });
		fireEvent.click(screen.getByRole('button', { name: 'Send' }));

		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith({
				title: 'Notify on-call failed',
				description: 'HTTP 500',
				variant: 'destructive',
			})
		);
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(message).toHaveValue('Keep this edit');
	});

	test('keeps the dialog and edited text after a thrown error', async () => {
		const onOpenChange = vi.fn();
		previewMutateAsync.mockResolvedValue(previews.slack);
		runMutateAsync.mockRejectedValue(new Error('network down'));
		renderDialog({ action: actions.slack, onOpenChange });

		const message = await screen.findByLabelText('Message');
		fireEvent.change(message, { target: { value: 'Keep this edit too' } });
		fireEvent.click(screen.getByRole('button', { name: 'Send' }));

		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith({
				title: 'Notify on-call failed',
				description: 'network down',
				variant: 'destructive',
			})
		);
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(message).toHaveValue('Keep this edit too');
	});
});

describe('ActionSendDialog: cancel', () => {
	test('closes without running the action', async () => {
		const onOpenChange = vi.fn();
		previewMutateAsync.mockResolvedValue(previews.slack);
		renderDialog({ action: actions.slack, onOpenChange });

		fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(runMutateAsync).not.toHaveBeenCalled();
	});
});

beforeEach(() => {
	previewMutateAsync.mockReset();
	runMutateAsync.mockReset();
	toastMock.mockReset();
	window.HTMLElement.prototype.scrollIntoView = vi.fn();
});
