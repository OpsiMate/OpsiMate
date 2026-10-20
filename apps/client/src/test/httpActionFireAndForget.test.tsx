import { beforeEach, describe, expect, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { Action, ActionPreview, HttpActionConfig } from '@OpsiMate/shared';
import { ActionFormDialog } from '@/components/Actions/ActionFormDialog';
import { ActionSendDialog } from '@/components/Alerts/AlertDetails/AlertActionsSection/ActionSendDialog';
import type { ActionPayload } from '@/lib/api';
import { render, screen, waitFor } from './test-utils';

// The HTTP action's "Don't wait for a response" switch: off for a new action, loaded
// from the saved config on edit, and sent as config.fireAndForget on save. The Send
// dialog tells the user when a run will not wait.

const createMutateAsync = vi.fn<(payload: ActionPayload) => Promise<Action>>();
const updateMutateAsync = vi.fn<(input: UpdateInput) => Promise<Action>>();
const previewMutateAsync = vi.fn<() => Promise<ActionPreview>>();

interface UpdateInput {
	id: number;
	payload: ActionPayload;
}

vi.mock('@/hooks/queries/alerts', () => ({ useAlerts: () => ({ data: [] }) }));
vi.mock('@/hooks/queries/actions', () => ({
	useCreateAction: () => ({ isPending: false, mutateAsync: createMutateAsync }),
	useUpdateAction: () => ({ isPending: false, mutateAsync: updateMutateAsync }),
	useTestAction: () => ({ isPending: false }),
	usePreviewAction: () => ({ isPending: false, mutateAsync: previewMutateAsync }),
	useRunAction: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

const httpAction = (config: Partial<HttpActionConfig>): Action => ({
	id: 7,
	name: 'Kick off the deploy',
	type: 'http',
	config: { url: 'https://example.com/hook', method: 'POST', ...config },
	labelMatchers: [],
	createdAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
});

const sampleAlert = {
	id: 'disk-1',
	alertName: 'Disk full',
	status: 'firing',
	severity: 'critical',
	type: 'Custom',
	tags: {},
	startsAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
	createdAt: new Date(0).toISOString(),
	isSilenced: false,
	isRead: false,
} as unknown as Parameters<typeof ActionSendDialog>[0]['alert'];

const sentConfig = (): HttpActionConfig => {
	const payload = updateMutateAsync.mock.calls[0][0].payload;
	return payload.config as HttpActionConfig;
};

beforeEach(() => {
	createMutateAsync.mockReset();
	updateMutateAsync.mockReset();
	previewMutateAsync.mockReset();
	// Radix Switch and Select need these in jsdom.
	window.HTMLElement.prototype.scrollIntoView = vi.fn();
	window.HTMLElement.prototype.hasPointerCapture = vi.fn();
	window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

describe('ActionFormDialog: don’t wait for a response', () => {
	test('is off for a new HTTP action and saved as false', async () => {
		const user = userEvent.setup();
		createMutateAsync.mockResolvedValue(httpAction({}));
		render(<ActionFormDialog open onOpenChange={vi.fn()} />);

		await user.type(screen.getByLabelText('Name'), 'Ping the runbook');
		const typeTrigger = screen.getByText('Slack message').closest('[role="combobox"]');
		if (!typeTrigger) throw new Error('type select not found');
		await user.click(typeTrigger);
		await user.click(await screen.findByRole('option', { name: /HTTP request/ }));
		await user.type(screen.getByLabelText(/^URL/), 'https://example.com/hook');

		const toggle = screen.getByRole('switch', { name: "Don't wait for a response" });
		expect(toggle).toHaveAttribute('aria-checked', 'false');

		await user.click(screen.getByRole('button', { name: 'Create action' }));
		await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
		expect((createMutateAsync.mock.calls[0][0].config as HttpActionConfig).fireAndForget).toBe(false);
	});

	test('loads the saved value on edit and sends the toggled value on save', async () => {
		const user = userEvent.setup();
		updateMutateAsync.mockResolvedValue(httpAction({ fireAndForget: false }));
		render(<ActionFormDialog open onOpenChange={vi.fn()} action={httpAction({ fireAndForget: true })} />);

		const toggle = screen.getByRole('switch', { name: "Don't wait for a response" });
		expect(toggle).toHaveAttribute('aria-checked', 'true');

		await user.click(toggle);
		expect(toggle).toHaveAttribute('aria-checked', 'false');

		await user.click(screen.getByRole('button', { name: 'Save changes' }));
		await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
		expect(updateMutateAsync.mock.calls[0][0].id).toBe(7);
		expect(sentConfig().fireAndForget).toBe(false);
		expect(sentConfig().url).toBe('https://example.com/hook');
	});

	test('a saved action without the flag edits as off', () => {
		render(<ActionFormDialog open onOpenChange={vi.fn()} action={httpAction({})} />);
		expect(screen.getByRole('switch', { name: "Don't wait for a response" })).toHaveAttribute(
			'aria-checked',
			'false'
		);
	});
});

describe('ActionSendDialog: don’t wait for a response', () => {
	const preview: ActionPreview = { type: 'http', method: 'POST', url: 'https://example.com/hook', body: '{}' };

	test('tells the user when the run will not wait', async () => {
		previewMutateAsync.mockResolvedValue(preview);
		render(
			<ActionSendDialog
				open
				onOpenChange={vi.fn()}
				action={httpAction({ fireAndForget: true })}
				alert={sampleAlert}
			/>
		);
		expect(await screen.findByText(/doesn't wait for a response/)).toBeInTheDocument();
	});

	test('says nothing for an action that waits', async () => {
		previewMutateAsync.mockResolvedValue(preview);
		render(<ActionSendDialog open onOpenChange={vi.fn()} action={httpAction({})} alert={sampleAlert} />);
		expect(await screen.findByLabelText('Request body')).toBeInTheDocument();
		expect(screen.queryByText(/doesn't wait for a response/)).not.toBeInTheDocument();
	});
});
