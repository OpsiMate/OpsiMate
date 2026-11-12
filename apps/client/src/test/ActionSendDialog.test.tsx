import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
	AlertSeverity,
	AlertStatus,
	type Action,
	type ActionConfig,
	type ActionOverrides,
	type ActionPreview,
	type ActionTestResult,
	type ActionType,
	type Alert,
	type HttpActionPreview,
	type JiraActionPreview,
	type SlackActionPreview,
	type TeamsActionPreview,
} from '@OpsiMate/shared';
import { ActionSendDialog } from '@/components/Alerts/AlertDetails/AlertActionsSection/ActionSendDialog';
import { cleanup, fireEvent, render, screen, waitFor } from './test-utils';

// The Send dialog reviews an action about to run from an alert: the preview pre-fills the
// fields the sender may edit per action type, the destination row shows only the webhook
// host (never the secret path), edits go out as overrides, and each run outcome lands on
// the right toast with the dialog closing only on success.

const { previewMutateAsync, runMutateAsync, toastMock } = vi.hoisted(() => ({
	previewMutateAsync: vi.fn<(input: PreviewInput) => Promise<ActionPreview>>(),
	runMutateAsync: vi.fn<(input: RunInput) => Promise<ActionTestResult>>(),
	toastMock: vi.fn<(args: ToastArgs) => void>(),
}));

interface PreviewInput {
	id: number;
	alert: Alert;
}

interface RunInput {
	id: number;
	alert: Alert;
	overrides: ActionOverrides;
}

interface ToastArgs {
	title: string;
	description: string;
	variant?: string;
}

vi.mock('@/hooks/queries/actions', () => ({
	usePreviewAction: () => ({ isPending: false, mutateAsync: previewMutateAsync }),
	useRunAction: () => ({ isPending: false, mutateAsync: runMutateAsync }),
}));

vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast: toastMock }),
}));

const sampleAlert: Alert = {
	id: 'alert-1',
	type: 'Custom',
	status: AlertStatus.FIRING,
	severity: AlertSeverity.CRITICAL,
	tags: { env: 'prod' },
	startsAt: '2026-10-25T10:00:00.000Z',
	updatedAt: '2026-10-25T10:05:00.000Z',
	alertUrl: 'https://grafana.example.com/disk-1',
	alertName: 'Disk full on prod-1',
	createdAt: '2026-10-25T09:00:00.000Z',
	isSilenced: false,
};

const actionOf = (name: string, type: ActionType, config: ActionConfig): Action => ({
	id: 7,
	name,
	type,
	config,
	labelMatchers: [],
	createdAt: '2026-10-01T10:00:00.000Z',
	updatedAt: '2026-10-01T10:00:00.000Z',
});

const slackAction = actionOf('On-call ping', 'slack', {
	webhookUrl: 'https://hooks.slack.com/services/T000AAA/B000BBB/SECRETVALUE',
	channel: '#ops',
});
const teamsAction = actionOf('Team broadcast', 'teams', {
	webhookUrl: 'https://outlook.office.com/webhook/UUIDSECRET',
});
const jiraAction = actionOf('Open a ticket', 'jira', {
	baseUrl: 'https://jira.example.com',
	email: 'ops@example.com',
	apiToken: 'server-side-only',
	projectKey: 'PROJ',
	issueType: 'Bug',
});
const httpAction = actionOf('Kick off the deploy', 'http', {
	url: 'https://example.com/deploy',
	method: 'POST',
});

const slackPreview: SlackActionPreview = {
	type: 'slack',
	message: 'prod-1 disk 97%',
	channel: '#ops',
	webhookUrl: 'https://hooks.slack.com/services/T000AAA/B000BBB/SECRETVALUE',
};

const teamsPreview: TeamsActionPreview = {
	type: 'teams',
	title: 'Disk full',
	message: 'prod-1 disk 97%',
	webhookUrl: 'https://outlook.office.com/webhook/UUIDSECRET',
};

const jiraPreview: JiraActionPreview = {
	type: 'jira',
	summary: 'Disk full on prod-1',
	description: 'Root disk at 97%',
	baseUrl: 'https://jira.example.com',
	projectKey: 'PROJ',
	issueType: 'Bug',
};

const httpPreview: HttpActionPreview = {
	type: 'http',
	method: 'POST',
	url: 'https://example.com/deploy',
	body: '{"host":"prod-1"}',
};

const renderDialog = (action: Action) => {
	const onOpenChange = vi.fn();
	render(<ActionSendDialog open onOpenChange={onOpenChange} action={action} alert={sampleAlert} />);
	return { onOpenChange };
};

// Fields are edited with fireEvent rather than user-event's typing, whose keyboard syntax
// would read the braces of an HTTP JSON body as key descriptors.
const editField = async (label: string, value: string) => {
	fireEvent.change(await screen.findByLabelText(label), { target: { value } });
};

const sendWithEdits = async (action: Action, preview: ActionPreview, edits: FieldEdit[]) => {
	previewMutateAsync.mockResolvedValue(preview);
	runMutateAsync.mockResolvedValue({ ok: true, message: 'delivered' });
	renderDialog(action);
	for (const edit of edits) {
		await editField(edit.label, edit.value);
	}
	fireEvent.click(screen.getByRole('button', { name: 'Send' }));
	await waitFor(() => expect(runMutateAsync).toHaveBeenCalledTimes(1));
};

interface FieldEdit {
	label: string;
	value: string;
}

beforeEach(() => {
	// Radix needs these in jsdom for the dialog's focus handling.
	window.HTMLElement.prototype.scrollIntoView = vi.fn();
	window.HTMLElement.prototype.hasPointerCapture = vi.fn();
	window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('ActionSendDialog: preview prefill', () => {
	test('Slack: prefills the message and shows the channel and webhook host, never the secret path', async () => {
		previewMutateAsync.mockResolvedValue(slackPreview);
		renderDialog(slackAction);

		expect(await screen.findByLabelText('Message')).toHaveValue('prod-1 disk 97%');
		expect(screen.getByText('Slack · #ops (hooks.slack.com)')).toBeInTheDocument();
		expect(screen.queryByText(/SECRETVALUE|T000AAA|B000BBB|services/)).not.toBeInTheDocument();
		expect(previewMutateAsync).toHaveBeenCalledWith({ id: 7, alert: sampleAlert });
	});

	test('Teams: prefills title and message and shows only the webhook host', async () => {
		previewMutateAsync.mockResolvedValue(teamsPreview);
		renderDialog(teamsAction);

		expect(await screen.findByLabelText('Title')).toHaveValue('Disk full');
		expect(screen.getByLabelText('Message')).toHaveValue('prod-1 disk 97%');
		expect(screen.getByText('Microsoft Teams (outlook.office.com)')).toBeInTheDocument();
		expect(screen.queryByText(/webhook\/UUIDSECRET|UUIDSECRET/)).not.toBeInTheDocument();
	});

	test('Jira: prefills summary and description and shows the project, issue type and host', async () => {
		previewMutateAsync.mockResolvedValue(jiraPreview);
		renderDialog(jiraAction);

		expect(await screen.findByLabelText('Summary')).toHaveValue('Disk full on prod-1');
		expect(screen.getByLabelText('Description')).toHaveValue('Root disk at 97%');
		expect(screen.getByText('PROJ · Bug (jira.example.com)')).toBeInTheDocument();
	});

	test('HTTP: prefills the request body and shows the method and URL', async () => {
		previewMutateAsync.mockResolvedValue(httpPreview);
		renderDialog(httpAction);

		expect(await screen.findByLabelText('Request body')).toHaveValue('{"host":"prod-1"}');
		expect(screen.getByText('POST https://example.com/deploy')).toBeInTheDocument();
	});

	test('a failed preview shows the server error and keeps Send disabled', async () => {
		previewMutateAsync.mockRejectedValue(new Error('The preview endpoint melted down'));
		renderDialog(slackAction);

		expect(await screen.findByText('The preview endpoint melted down')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
		expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
	});
});

describe('ActionSendDialog: overrides sent on Send', () => {
	test('Slack: sends the edited message', async () => {
		await sendWithEdits(slackAction, slackPreview, [{ label: 'Message', value: 'Escalate now' }]);

		expect(runMutateAsync).toHaveBeenCalledWith({
			id: 7,
			alert: sampleAlert,
			overrides: { message: 'Escalate now' },
		});
	});

	test('Teams: sends the edited title and message', async () => {
		await sendWithEdits(teamsAction, teamsPreview, [
			{ label: 'Title', value: 'P1: disk full' },
			{ label: 'Message', value: 'Escalate' },
		]);

		expect(runMutateAsync).toHaveBeenCalledWith({
			id: 7,
			alert: sampleAlert,
			overrides: { title: 'P1: disk full', message: 'Escalate' },
		});
	});

	test('Jira: sends the edited summary and description', async () => {
		await sendWithEdits(jiraAction, jiraPreview, [
			{ label: 'Summary', value: 'Disk 99%' },
			{ label: 'Description', value: 'Add space today' },
		]);

		expect(runMutateAsync).toHaveBeenCalledWith({
			id: 7,
			alert: sampleAlert,
			overrides: { summary: 'Disk 99%', description: 'Add space today' },
		});
	});

	test('HTTP: sends the edited body', async () => {
		await sendWithEdits(httpAction, httpPreview, [{ label: 'Request body', value: '{"host":"prod-9"}' }]);

		expect(runMutateAsync).toHaveBeenCalledWith({
			id: 7,
			alert: sampleAlert,
			overrides: { body: '{"host":"prod-9"}' },
		});
	});
});

describe('ActionSendDialog: run outcomes', () => {
	test('a successful run toasts success and closes the dialog', async () => {
		previewMutateAsync.mockResolvedValue(slackPreview);
		runMutateAsync.mockResolvedValue({ ok: true, message: 'Message delivered' });
		const { onOpenChange } = renderDialog(slackAction);

		await screen.findByLabelText('Message');
		fireEvent.click(screen.getByRole('button', { name: 'Send' }));

		await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1));
		expect(toastMock).toHaveBeenCalledWith({
			title: 'On-call ping sent',
			description: 'Message delivered',
			variant: undefined,
		});
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	test('a run the receiver rejects toasts failure and keeps the dialog open', async () => {
		previewMutateAsync.mockResolvedValue(slackPreview);
		runMutateAsync.mockResolvedValue({ ok: false, message: 'Slack answered 404' });
		const { onOpenChange } = renderDialog(slackAction);

		await screen.findByLabelText('Message');
		fireEvent.click(screen.getByRole('button', { name: 'Send' }));

		await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1));
		expect(toastMock).toHaveBeenCalledWith({
			title: 'On-call ping failed',
			description: 'Slack answered 404',
			variant: 'destructive',
		});
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	test('a thrown run error toasts failure and keeps the dialog open', async () => {
		previewMutateAsync.mockResolvedValue(slackPreview);
		runMutateAsync.mockRejectedValue(new Error('Connection refused'));
		const { onOpenChange } = renderDialog(slackAction);

		await screen.findByLabelText('Message');
		fireEvent.click(screen.getByRole('button', { name: 'Send' }));

		await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1));
		expect(toastMock).toHaveBeenCalledWith({
			title: 'On-call ping failed',
			description: 'Connection refused',
			variant: 'destructive',
		});
		expect(onOpenChange).not.toHaveBeenCalled();
	});
});

describe('ActionSendDialog: cancel', () => {
	test('closes the dialog without running the action', async () => {
		previewMutateAsync.mockResolvedValue(slackPreview);
		const { onOpenChange } = renderDialog(slackAction);

		await screen.findByLabelText('Message');
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(runMutateAsync).not.toHaveBeenCalled();
	});
});
