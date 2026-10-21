import { beforeEach, describe, expect, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { Action, ActionPreview, HttpActionConfig } from '@OpsiMate/shared';
import { ActionSendDialog } from '@/components/Alerts/AlertDetails/AlertActionsSection/ActionSendDialog';
import { render, screen, waitFor, within } from './test-utils';

// Sending an HTTP action from an alert: a JSON body is shown as a form of the rendered
// request, so a person can change a value before it goes out — and what is sent is the
// edited JSON. A body declared plain text keeps the text box.

const previewMutateAsync = vi.fn<() => Promise<ActionPreview>>();
const runMutateAsync = vi.fn();

vi.mock('@/hooks/queries/actions', () => ({
	usePreviewAction: () => ({ isPending: false, mutateAsync: previewMutateAsync }),
	useRunAction: () => ({ isPending: false, mutateAsync: runMutateAsync }),
}));

const httpAction = (config: Partial<HttpActionConfig>): Action => ({
	id: 7,
	name: 'Open ticket',
	type: 'http',
	config: { url: 'https://example.com/hook', method: 'POST', ...config },
	labelMatchers: [],
	createdAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
});

const alert = {
	id: 'disk-1',
	alertName: 'Disk full',
	status: 'firing',
	severity: 'critical',
	tags: {},
} as unknown as Parameters<typeof ActionSendDialog>[0]['alert'];

const rendered =
	'{\n  "title": "[critical] Disk full",\n  "details": "disk \\"sda\\" at 95%",\n  "urgent": true,\n  "labels": { "env": "prod" }\n}';

beforeEach(() => {
	previewMutateAsync.mockReset();
	runMutateAsync.mockReset();
	runMutateAsync.mockResolvedValue({ ok: true, message: 'sent' });
	window.HTMLElement.prototype.scrollIntoView = vi.fn();
	window.HTMLElement.prototype.hasPointerCapture = vi.fn();
	window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

describe('ActionSendDialog: JSON body as a form', () => {
	test('shows the rendered body as rows and sends the edited JSON', async () => {
		const user = userEvent.setup();
		previewMutateAsync.mockResolvedValue({
			type: 'http',
			method: 'POST',
			url: 'https://example.com/hook',
			body: rendered,
		});
		render(
			<ActionSendDialog open onOpenChange={vi.fn()} action={httpAction({ bodyFormat: 'json' })} alert={alert} />
		);

		const form = await screen.findByLabelText('Request body');
		const names = within(form)
			.getAllByLabelText('Field name')
			.map((el) => (el as HTMLInputElement).value);
		expect(names).toEqual(['title', 'details', 'urgent', 'labels', 'env']);
		// The escaped quote came through as a real quote in the field.
		const details = within(form).getAllByLabelText('Field value')[1] as HTMLInputElement;
		expect(details.value).toBe('disk "sda" at 95%');

		await user.type(details, ' — checking');
		await user.click(screen.getByRole('button', { name: 'Send' }));
		await waitFor(() => expect(runMutateAsync).toHaveBeenCalledTimes(1));
		const sent = JSON.parse(runMutateAsync.mock.calls[0][0].overrides.body as string);
		expect(sent).toEqual({
			title: '[critical] Disk full',
			details: 'disk "sda" at 95% — checking',
			urgent: true,
			labels: { env: 'prod' },
		});
	});

	test('a body declared plain text keeps the text box', async () => {
		previewMutateAsync.mockResolvedValue({
			type: 'http',
			method: 'POST',
			url: 'https://example.com/hook',
			body: 'ALERT Disk full',
		});
		render(
			<ActionSendDialog open onOpenChange={vi.fn()} action={httpAction({ bodyFormat: 'text' })} alert={alert} />
		);
		const box = await screen.findByLabelText('Request body');
		expect(box.tagName).toBe('TEXTAREA');
		expect(box).toHaveValue('ALERT Disk full');
		expect(screen.queryByRole('button', { name: 'Form' })).not.toBeInTheDocument();
	});

	test('an older action without the flag gets the form when its rendered body is JSON', async () => {
		previewMutateAsync.mockResolvedValue({
			type: 'http',
			method: 'POST',
			url: 'https://example.com/hook',
			body: '{"a": "1"}',
		});
		render(<ActionSendDialog open onOpenChange={vi.fn()} action={httpAction({})} alert={alert} />);
		const form = await screen.findByLabelText('Request body');
		expect(within(form).getByLabelText('Field name')).toHaveValue('a');
	});
});
