import { CallbackSettings, callbackFormErrors, rowsToHeaders } from '@/components/Settings/CallbackSettings';
import { AlertCallback } from '@OpsiMate/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AllTheProviders } from './TestProviders';

// Settings > Callbacks. The query hooks are mocked at the module boundary: these tests
// are about what an admin can configure and the one rule that matters most — a
// callback is OFF until it is explicitly turned on.

interface MutationCalls {
	create: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	remove: ReturnType<typeof vi.fn>;
	test: ReturnType<typeof vi.fn>;
}

interface ListState {
	current: AlertCallback[];
}

const { calls, listState } = vi.hoisted((): { calls: MutationCalls; listState: ListState } => ({
	calls: { create: vi.fn(), update: vi.fn(), remove: vi.fn(), test: vi.fn() },
	listState: { current: [] },
}));

vi.mock('@/hooks/queries/callbacks', () => ({
	useCallbacks: () => ({ data: listState.current, isLoading: false, error: null }),
	useCreateCallback: () => ({ mutateAsync: calls.create, isPending: false }),
	useUpdateCallback: () => ({ mutateAsync: calls.update, isPending: false }),
	useDeleteCallback: () => ({ mutateAsync: calls.remove, isPending: false }),
	useTestCallback: () => ({ mutateAsync: calls.test, isPending: false }),
}));

// Radix form controls (Switch, Checkbox, Select) measure themselves with
// ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const callback = (overrides: Partial<AlertCallback> = {}): AlertCallback => ({
	id: 1,
	name: 'Ticketing sync',
	url: 'https://tickets.example.com/hook',
	method: 'POST',
	headers: { Authorization: 'Bearer abc' },
	bodyTemplate: null,
	events: ['resolved', 'owner_assigned'],
	enabled: true,
	lastStatus: 'success',
	lastError: null,
	lastSentAt: '2026-10-15 09:00:00',
	createdAt: '2026-10-15 08:00:00',
	updatedAt: '2026-10-15 08:00:00',
	...overrides,
});

const renderSettings = () =>
	render(
		<AllTheProviders>
			<CallbackSettings />
		</AllTheProviders>
	);

const dialog = () => screen.getByRole('dialog');

beforeEach(() => {
	// Create answers with the generated secret; a plain update answers without one.
	calls.create.mockReset().mockResolvedValue({ ...callback(), secret: 'generated-secret-0123456789' });
	calls.update.mockReset().mockResolvedValue(callback());
	calls.remove.mockReset().mockResolvedValue(undefined);
	calls.test.mockReset().mockResolvedValue({ ok: true, statusCode: 200, message: 'Delivered (200)' });
	listState.current = [];
});

describe('callbackFormErrors and rowsToHeaders', () => {
	test('requires a name, a full http(s) URL and at least one event', () => {
		expect(callbackFormErrors({ name: '  ', url: 'tickets.example.com', events: [] })).toEqual({
			name: 'Give the callback a name.',
			url: 'Enter a full http(s) URL.',
			events: 'Pick at least one event.',
		});
		expect(callbackFormErrors({ name: 'x', url: '', events: ['silenced'] })).toEqual({
			url: 'Enter the URL to send to.',
		});
		expect(callbackFormErrors({ name: 'x', url: 'https://a.test/h', events: ['silenced'] })).toEqual({});
	});

	test('blank header rows are dropped and an empty set is sent as null', () => {
		expect(
			rowsToHeaders([
				{ key: ' Authorization ', value: 'Bearer x' },
				{ key: '', value: 'ignored' },
			])
		).toEqual({ Authorization: 'Bearer x' });
		expect(rowsToHeaders([{ key: '', value: '' }])).toBeNull();
	});
});

describe('CallbackSettings list', () => {
	test('shows each callback with its events, last delivery and switch', () => {
		listState.current = [
			callback(),
			callback({
				id: 2,
				name: 'Silence audit',
				enabled: false,
				events: ['silenced'],
				lastStatus: 'error',
				lastError: 'HTTP 503 Service Unavailable',
			}),
			callback({ id: 3, name: 'Fresh', enabled: false, lastStatus: null, lastSentAt: null }),
		];
		renderSettings();

		const rows = screen.getAllByRole('row').slice(1);
		expect(rows).toHaveLength(3);
		expect(within(rows[0]).getByText('Resolved')).toBeInTheDocument();
		expect(within(rows[0]).getByText('Owner assigned')).toBeInTheDocument();
		expect(within(rows[0]).getByText(/Delivered/)).toBeInTheDocument();
		expect(within(rows[0]).getByRole('switch', { name: 'Disable Ticketing sync' })).toBeChecked();

		expect(within(rows[1]).getByText(/Failed/)).toBeInTheDocument();
		expect(within(rows[1]).getByRole('switch', { name: 'Enable Silence audit' })).not.toBeChecked();

		expect(within(rows[2]).getByText('Never sent')).toBeInTheDocument();
	});

	test('the switch sends only { enabled } for that callback', async () => {
		listState.current = [callback({ enabled: false })];
		renderSettings();

		fireEvent.click(screen.getByRole('switch', { name: 'Enable Ticketing sync' }));

		await waitFor(() => expect(calls.update).toHaveBeenCalledWith({ id: 1, payload: { enabled: true } }));
	});

	test('deleting asks first and then removes', async () => {
		listState.current = [callback()];
		renderSettings();

		fireEvent.click(screen.getByRole('button', { name: 'Delete Ticketing sync' }));
		expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete Ticketing sync?');
		expect(calls.remove).not.toHaveBeenCalled();

		fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
		await waitFor(() => expect(calls.remove).toHaveBeenCalledWith(1));
	});

	test('an empty list offers to create the first callback', () => {
		renderSettings();
		expect(screen.getByText(/No callbacks yet/)).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: /New callback/ })).toHaveLength(2);
	});
});

describe('CallbackFormDialog', () => {
	const openNew = () => {
		renderSettings();
		fireEvent.click(screen.getAllByRole('button', { name: /New callback/ })[0]);
		return dialog();
	};

	test('a new callback starts OFF, and is created off unless the switch is flipped', async () => {
		const d = openNew();
		expect(within(d).getByRole('switch', { name: 'Enabled' })).not.toBeChecked();

		fireEvent.change(within(d).getByLabelText('Name'), { target: { value: 'Pager' } });
		fireEvent.change(within(d).getByLabelText('URL'), { target: { value: 'https://pager.test/hook' } });
		fireEvent.click(within(d).getByRole('checkbox', { name: 'Silenced' }));
		fireEvent.click(within(d).getByRole('checkbox', { name: 'Resolved' }));
		fireEvent.click(within(d).getByRole('button', { name: 'Create' }));

		await waitFor(() => expect(calls.create).toHaveBeenCalledTimes(1));
		expect(calls.create).toHaveBeenCalledWith({
			name: 'Pager',
			url: 'https://pager.test/hook',
			method: 'POST',
			headers: null,
			bodyTemplate: null,
			events: ['silenced', 'resolved'],
			enabled: false,
		});
	});

	test('cannot be created without a name, a URL and an event', async () => {
		const d = openNew();
		fireEvent.click(within(d).getByRole('button', { name: 'Create' }));

		expect(
			within(d)
				.getAllByRole('alert')
				.map((a) => a.textContent)
		).toEqual(['Give the callback a name.', 'Enter the URL to send to.', 'Pick at least one event.']);
		expect(calls.create).not.toHaveBeenCalled();
	});

	test('headers, body template and the switch travel with the payload', async () => {
		const d = openNew();
		fireEvent.change(within(d).getByLabelText('Name'), { target: { value: 'Shaped' } });
		fireEvent.change(within(d).getByLabelText('URL'), { target: { value: 'https://shaped.test/' } });
		fireEvent.click(within(d).getByRole('button', { name: 'All' }));
		fireEvent.click(within(d).getByRole('button', { name: 'Add' }));
		fireEvent.change(within(d).getByLabelText('Header 1 name'), { target: { value: 'X-Token' } });
		fireEvent.change(within(d).getByLabelText('Header 1 value'), { target: { value: 'abc' } });
		fireEvent.change(within(d).getByLabelText('Body template (optional)'), {
			target: { value: '{"e":"{{event}}"}' },
		});
		fireEvent.click(within(d).getByRole('switch', { name: 'Enabled' }));
		fireEvent.click(within(d).getByRole('button', { name: 'Create' }));

		await waitFor(() => expect(calls.create).toHaveBeenCalledTimes(1));
		const payload = calls.create.mock.calls[0][0] as Record<string, unknown>;
		expect(payload.headers).toEqual({ 'X-Token': 'abc' });
		expect(payload.bodyTemplate).toBe('{"e":"{{event}}"}');
		expect(payload.enabled).toBe(true);
		expect((payload.events as string[]).length).toBe(9);
	});

	test('Send test uses the current fields and shows the receiver answer, without saving', async () => {
		const d = openNew();
		fireEvent.change(within(d).getByLabelText('URL'), { target: { value: 'https://probe.test/x' } });
		fireEvent.click(within(d).getByRole('button', { name: 'Send test' }));

		await waitFor(() => expect(calls.test).toHaveBeenCalledTimes(1));
		expect(calls.test).toHaveBeenCalledWith({
			url: 'https://probe.test/x',
			method: 'POST',
			headers: null,
			bodyTemplate: null,
			secret: undefined,
		});
		expect(await within(d).findByRole('status')).toHaveTextContent('Delivered (200)');
		expect(calls.create).not.toHaveBeenCalled();
	});

	test('creating reveals the generated secret once, then the dialog closes on Done', async () => {
		const d = openNew();
		fireEvent.change(within(d).getByLabelText('Name'), { target: { value: 'Pager' } });
		fireEvent.change(within(d).getByLabelText('URL'), { target: { value: 'https://pager.test/hook' } });
		fireEvent.click(within(d).getByRole('checkbox', { name: 'Silenced' }));
		fireEvent.click(within(d).getByRole('button', { name: 'Create' }));

		await waitFor(() => expect(within(d).getByText('Copy your signing secret')).toBeInTheDocument());
		expect(within(d).getByLabelText('Signing secret')).toHaveValue('generated-secret-0123456789');
		expect(within(d).getByRole('button', { name: 'Copy secret' })).toBeInTheDocument();

		fireEvent.click(within(d).getByRole('button', { name: 'Done' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	test('Send test on a saved callback asks the server to sign with its stored secret', async () => {
		listState.current = [callback()];
		renderSettings();
		fireEvent.click(screen.getByRole('button', { name: 'Edit Ticketing sync' }));
		const d = dialog();
		fireEvent.click(within(d).getByRole('button', { name: 'Send test' }));

		await waitFor(() => expect(calls.test).toHaveBeenCalledTimes(1));
		expect(calls.test.mock.calls[0][0]).toMatchObject({ url: 'https://tickets.example.com/hook', callbackId: 1 });
		expect((calls.test.mock.calls[0][0] as { secret?: string }).secret).toBeUndefined();
	});

	test('editing prefills the callback, never shows the secret, and sends the full payload', async () => {
		listState.current = [callback({ bodyTemplate: '{{payload}}' })];
		renderSettings();
		fireEvent.click(screen.getByRole('button', { name: 'Edit Ticketing sync' }));
		const d = dialog();

		expect(within(d).getByLabelText('Name')).toHaveValue('Ticketing sync');
		expect(within(d).getByLabelText('URL')).toHaveValue('https://tickets.example.com/hook');
		expect(within(d).getByLabelText('Header 1 name')).toHaveValue('Authorization');
		expect(within(d).getByRole('checkbox', { name: 'Resolved' })).toBeChecked();
		expect(within(d).getByRole('checkbox', { name: 'Silenced' })).not.toBeChecked();
		// The secret is not in the list response and is never shown again; only Rotate is offered.
		expect(within(d).getByText(/A secret is set/)).toBeInTheDocument();
		expect(within(d).queryByDisplayValue(/abcdef/)).not.toBeInTheDocument();
		expect(within(d).getByRole('button', { name: 'Rotate' })).toBeInTheDocument();
		expect(within(d).getByRole('switch', { name: 'Enabled' })).toBeChecked();

		fireEvent.click(within(d).getByRole('checkbox', { name: 'Silenced' }));
		fireEvent.click(within(d).getByRole('button', { name: 'Save' }));

		await waitFor(() => expect(calls.update).toHaveBeenCalledTimes(1));
		expect(calls.update).toHaveBeenCalledWith({
			id: 1,
			payload: {
				name: 'Ticketing sync',
				url: 'https://tickets.example.com/hook',
				method: 'POST',
				headers: { Authorization: 'Bearer abc' },
				bodyTemplate: '{{payload}}',
				events: ['resolved', 'owner_assigned', 'silenced'],
				enabled: true,
			},
		});
	});

	test('rotating the secret sends the new one and reveals it once; otherwise the secret is left alone', async () => {
		listState.current = [callback()];
		calls.update.mockResolvedValue({ ...callback(), secret: 'brand-new-secret' });
		renderSettings();
		fireEvent.click(screen.getByRole('button', { name: 'Edit Ticketing sync' }));
		const d = dialog();

		fireEvent.click(within(d).getByRole('button', { name: 'Rotate' }));
		fireEvent.change(within(d).getByLabelText('Signing secret'), { target: { value: 'brand-new-secret' } });
		fireEvent.click(within(d).getByRole('button', { name: 'Save' }));

		await waitFor(() => expect(calls.update).toHaveBeenCalledTimes(1));
		expect((calls.update.mock.calls[0][0] as { payload: { secret?: string } }).payload.secret).toBe(
			'brand-new-secret'
		);
		await waitFor(() => expect(within(d).getByText('Copy your signing secret')).toBeInTheDocument());
		expect(within(d).getByText(/The secret was rotated/)).toBeInTheDocument();
		expect(within(d).getByLabelText('Signing secret')).toHaveValue('brand-new-secret');
	});
});
