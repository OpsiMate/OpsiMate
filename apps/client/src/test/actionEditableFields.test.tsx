import { beforeEach, describe, expect, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { Action, ActionPreview, HttpActionConfig } from '@OpsiMate/shared';
import { ActionFormDialog } from '@/components/Actions/ActionFormDialog';
import { ActionSendDialog } from '@/components/Alerts/AlertDetails/AlertActionsSection/ActionSendDialog';
import { coerceFieldValue, getAtPath, listTemplateFields, pathLabel, setAtPath } from '@/lib/jsonFields';
import type { ActionPayload } from '@/lib/api';
import { render, screen, waitFor, within } from './test-utils';

// Fields the sender can change: the author ticks body fields when creating the action;
// the Send dialog on an alert shows just those, prefilled from the rendered request, and
// sends the body with the edits written in.

const createMutateAsync = vi.fn<(payload: ActionPayload) => Promise<Action>>();
const updateMutateAsync = vi.fn<(input: { id: number; payload: ActionPayload }) => Promise<Action>>();
const previewMutateAsync = vi.fn<() => Promise<ActionPreview>>();
const runMutateAsync = vi.fn();

vi.mock('@/hooks/queries/alerts', () => ({ useAlerts: () => ({ data: [] }) }));
vi.mock('@/hooks/queries/actions', () => ({
	useCreateAction: () => ({ isPending: false, mutateAsync: createMutateAsync }),
	useUpdateAction: () => ({ isPending: false, mutateAsync: updateMutateAsync }),
	useTestAction: () => ({ isPending: false }),
	usePreviewAction: () => ({ isPending: false, mutateAsync: previewMutateAsync }),
	useRunAction: () => ({ isPending: false, mutateAsync: runMutateAsync }),
}));

const TEMPLATE =
	'{"title":"[{{severity}}] {{name}}","comment":"","urgent":false,"labels":{"env":"{{label.env}}","site":"{{label.site}}"},"count":{{label.count}}}';

const httpAction = (config: Partial<HttpActionConfig>): Action => ({
	id: 7,
	name: 'Open ticket',
	type: 'http',
	config: { url: 'https://example.com/hook', method: 'POST', bodyFormat: 'json', bodyTemplate: TEMPLATE, ...config },
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

beforeEach(() => {
	createMutateAsync.mockReset();
	updateMutateAsync.mockReset();
	previewMutateAsync.mockReset();
	runMutateAsync.mockReset();
	runMutateAsync.mockResolvedValue({ ok: true, message: 'sent' });
	window.HTMLElement.prototype.scrollIntoView = vi.fn();
	window.HTMLElement.prototype.hasPointerCapture = vi.fn();
	window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

describe('jsonFields', () => {
	test('lists the leaves of a template in order, with their kind and sample', () => {
		expect(listTemplateFields(TEMPLATE).map((f) => [f.path, f.kind, f.sample])).toEqual([
			['title', 'string', '[{{severity}}] {{name}}'],
			['comment', 'string', ''],
			['urgent', 'boolean', 'false'],
			['labels.env', 'string', '{{label.env}}'],
			['labels.site', 'string', '{{label.site}}'],
			['count', 'variable', '{{label.count}}'],
		]);
		expect(listTemplateFields('{"a":')).toEqual([]);
		expect(pathLabel('tags.0')).toBe('tags › #1');
	});

	test('reads and writes by path without touching the rest, keeping the field type', () => {
		const body = { a: { b: 1 }, list: ['x', 'y'], flag: true };
		expect(getAtPath(body, 'a.b')).toBe(1);
		expect(getAtPath(body, 'list.1')).toBe('y');
		const next = setAtPath(body, 'a.b', coerceFieldValue(1, '42')) as typeof body;
		expect(next.a.b).toBe(42);
		expect(body.a.b).toBe(1);
		expect(setAtPath(body, 'list.0', 'z')).toMatchObject({ list: ['z', 'y'] });
		expect(coerceFieldValue(true, 'false')).toBe(false);
		expect(coerceFieldValue('text', '7')).toBe('7');
		expect(coerceFieldValue(1, 'not a number')).toBe('not a number');
	});
});

describe('ActionFormDialog: fields the sender can change', () => {
	test('lists the body fields; ticking one with a label saves it in the config', async () => {
		const user = userEvent.setup();
		updateMutateAsync.mockResolvedValue(httpAction({}));
		render(<ActionFormDialog open onOpenChange={vi.fn()} action={httpAction({})} />);

		const list = screen.getByRole('list', { name: 'Fields the sender can change' });
		expect(within(list).getAllByRole('listitem')).toHaveLength(6);
		await user.click(within(list).getByRole('checkbox', { name: 'Sender can change comment' }));
		await user.type(within(list).getByLabelText('Label for comment'), 'Note for the ticket');
		await user.click(within(list).getByRole('checkbox', { name: 'Multi-line comment' }));
		await user.click(within(list).getByRole('checkbox', { name: 'Sender can change labels › site' }));

		await user.click(screen.getByRole('button', { name: 'Save changes' }));
		await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
		const config = updateMutateAsync.mock.calls[0][0].payload.config as HttpActionConfig;
		expect(config.editableFields).toEqual([
			{ path: 'comment', label: 'Note for the ticket', multiline: true },
			{ path: 'labels.site' },
		]);
	});

	test('a field ticked earlier that is no longer in the body is flagged', () => {
		render(
			<ActionFormDialog
				open
				onOpenChange={vi.fn()}
				action={httpAction({ editableFields: [{ path: 'gone' }, { path: 'comment' }] })}
			/>
		);
		expect(screen.getByText(/not in the body any more/)).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Sender can change comment' })).toHaveAttribute(
			'aria-checked',
			'true'
		);
	});
});

describe('ActionSendDialog: only the chosen fields', () => {
	const rendered = JSON.stringify({
		title: '[critical] Disk full',
		comment: '',
		urgent: false,
		labels: { env: 'prod', site: 'IL' },
		count: 3,
	});

	test('shows the chosen fields prefilled, and sends the body with the edits written in', async () => {
		const user = userEvent.setup();
		previewMutateAsync.mockResolvedValue({
			type: 'http',
			method: 'POST',
			url: 'https://example.com/hook',
			body: rendered,
		});
		render(
			<ActionSendDialog
				open
				onOpenChange={vi.fn()}
				action={httpAction({
					editableFields: [
						{ path: 'comment', label: 'Note for the ticket', multiline: true },
						{ path: 'labels.site' },
						{ path: 'urgent' },
						{ path: 'count' },
					],
				})}
				alert={alert}
			/>
		);

		const note = await screen.findByLabelText(/Note for the ticket/);
		expect(note.tagName).toBe('TEXTAREA');
		expect(screen.getByLabelText('labels › site')).toHaveValue('IL');
		// No raw body box: the rest of the request is folded away, read-only.
		expect(screen.queryByLabelText('Request body')).not.toBeInTheDocument();
		expect(screen.getByLabelText('Full request body')).toHaveTextContent('"title": "[critical] Disk full"');

		await user.type(note, 'Checked the "sda" disk\nreplacing it');
		await user.clear(screen.getByLabelText('labels › site'));
		await user.type(screen.getByLabelText('labels › site'), 'IL 🇮🇱');
		await user.click(screen.getByRole('switch', { name: 'urgent' }));
		await user.clear(screen.getByLabelText('count'));
		await user.type(screen.getByLabelText('count'), '4');

		await user.click(screen.getByRole('button', { name: 'Send' }));
		await waitFor(() => expect(runMutateAsync).toHaveBeenCalledTimes(1));
		expect(JSON.parse(runMutateAsync.mock.calls[0][0].overrides.body as string)).toEqual({
			title: '[critical] Disk full',
			comment: 'Checked the "sda" disk\nreplacing it',
			urgent: true,
			labels: { env: 'prod', site: 'IL 🇮🇱' },
			count: 4,
		});
	});

	test('without chosen fields the raw body box is shown, as before', async () => {
		previewMutateAsync.mockResolvedValue({
			type: 'http',
			method: 'POST',
			url: 'https://example.com/hook',
			body: rendered,
		});
		render(<ActionSendDialog open onOpenChange={vi.fn()} action={httpAction({})} alert={alert} />);
		expect(await screen.findByLabelText('Request body')).toHaveValue(rendered);
	});
});
