import { beforeEach, describe, expect, test, vi } from 'vitest';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { Action, HttpActionConfig } from '@OpsiMate/shared';
import { ActionFormDialog } from '@/components/Actions/ActionFormDialog';
import type { ActionPayload } from '@/lib/api';
import { render, screen, waitFor } from './test-utils';

// The HTTP action's "Body is JSON" checkbox: on for a new action and saved as
// bodyFormat 'json'; an action saved before the field existed edits as text (its
// behaviour must not change by itself) with a nudge when the body looks like JSON; a
// JSON body that is not valid JSON cannot be saved and says why.

const createMutateAsync = vi.fn<(payload: ActionPayload) => Promise<Action>>();
const updateMutateAsync = vi.fn<(input: { id: number; payload: ActionPayload }) => Promise<Action>>();

vi.mock('@/hooks/queries/alerts', () => ({ useAlerts: () => ({ data: [] }) }));
vi.mock('@/hooks/queries/actions', () => ({
	useCreateAction: () => ({ isPending: false, mutateAsync: createMutateAsync }),
	useUpdateAction: () => ({ isPending: false, mutateAsync: updateMutateAsync }),
	useTestAction: () => ({ isPending: false }),
	usePreviewAction: () => ({ isPending: false, mutateAsync: vi.fn() }),
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

const slackAction: Action = {
	id: 8,
	name: 'Page the on-call',
	type: 'slack',
	config: { webhookUrl: 'https://hooks.slack.com/x' },
	labelMatchers: [],
	createdAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
};

const jsonCheckbox = () => screen.getByRole('checkbox', { name: 'Body is JSON' });

const switchTypeToHttp = async (user: UserEvent) => {
	const typeTrigger = screen.getByText('Slack message').closest('[role="combobox"]');
	if (!typeTrigger) throw new Error('type select not found');
	await user.click(typeTrigger);
	await user.click(await screen.findByRole('option', { name: /HTTP request/ }));
};

beforeEach(() => {
	createMutateAsync.mockReset();
	updateMutateAsync.mockReset();
	window.HTMLElement.prototype.scrollIntoView = vi.fn();
	window.HTMLElement.prototype.hasPointerCapture = vi.fn();
	window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

describe('ActionFormDialog: body is JSON', () => {
	test('a new HTTP action has it on and saves bodyFormat json', async () => {
		const user = userEvent.setup();
		createMutateAsync.mockResolvedValue(httpAction({}));
		render(<ActionFormDialog open onOpenChange={vi.fn()} />);

		await user.type(screen.getByLabelText('Name'), 'Notify');
		const typeTrigger = screen.getByText('Slack message').closest('[role="combobox"]');
		if (!typeTrigger) throw new Error('type select not found');
		await user.click(typeTrigger);
		await user.click(await screen.findByRole('option', { name: /HTTP request/ }));
		await user.type(screen.getByLabelText(/^URL/), 'https://example.com/hook');
		expect(jsonCheckbox()).toHaveAttribute('aria-checked', 'true');

		await user.click(screen.getByRole('button', { name: 'Create action' }));
		await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
		expect((createMutateAsync.mock.calls[0][0].config as HttpActionConfig).bodyFormat).toBe('json');
	});

	test('an action saved before the field edits as text, with a nudge when the body looks like JSON', async () => {
		const user = userEvent.setup();
		updateMutateAsync.mockResolvedValue(httpAction({}));
		render(
			<ActionFormDialog open onOpenChange={vi.fn()} action={httpAction({ bodyTemplate: '{"t":"{{name}}"}' })} />
		);
		expect(jsonCheckbox()).toHaveAttribute('aria-checked', 'false');
		expect(screen.getByText(/This looks like JSON/)).toBeInTheDocument();

		await user.click(jsonCheckbox());
		expect(screen.queryByText(/This looks like JSON/)).not.toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Save changes' }));
		await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
		expect((updateMutateAsync.mock.calls[0][0].payload.config as HttpActionConfig).bodyFormat).toBe('json');
	});

	test('a JSON body that is not valid JSON cannot be saved and says why', async () => {
		const user = userEvent.setup();
		render(
			<ActionFormDialog
				open
				onOpenChange={vi.fn()}
				action={httpAction({ bodyTemplate: '{"t":"{{name}}" "x":1}', bodyFormat: 'json' })}
			/>
		);
		expect(screen.getByRole('alert')).toHaveTextContent(/Body is not valid JSON/);
		expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

		const body = screen.getByLabelText(/Request body template/);
		await user.clear(body);
		await user.click(body);
		await user.paste('{"t":"{{name}}"}');
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
	});

	test("editing a Slack action after an HTTP one does not keep that action's JSON setting or sender fields", async () => {
		const user = userEvent.setup();
		updateMutateAsync.mockResolvedValue(slackAction);
		const textAction = httpAction({ bodyFormat: 'text' });
		const { rerender } = render(<ActionFormDialog open onOpenChange={vi.fn()} action={textAction} />);
		rerender(<ActionFormDialog open={false} onOpenChange={vi.fn()} action={textAction} />);
		rerender(<ActionFormDialog open onOpenChange={vi.fn()} action={slackAction} />);
		await switchTypeToHttp(user);
		expect(jsonCheckbox()).toHaveAttribute('aria-checked', 'true');

		const senderFieldsAction = httpAction({ bodyFormat: 'json', editableFields: [{ path: '/comment' }] });
		rerender(<ActionFormDialog open={false} onOpenChange={vi.fn()} action={slackAction} />);
		rerender(<ActionFormDialog open onOpenChange={vi.fn()} action={senderFieldsAction} />);
		rerender(<ActionFormDialog open={false} onOpenChange={vi.fn()} action={senderFieldsAction} />);
		rerender(<ActionFormDialog open onOpenChange={vi.fn()} action={slackAction} />);
		await switchTypeToHttp(user);
		await user.type(screen.getByLabelText(/^URL/), 'https://example.com/hook');
		await user.click(screen.getByLabelText(/Request body template/));
		await user.paste('{"comment":""}');
		await user.click(screen.getByRole('button', { name: 'Save changes' }));
		await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
		expect((updateMutateAsync.mock.calls[0][0].payload.config as HttpActionConfig).editableFields).toBeNull();
	});
});
