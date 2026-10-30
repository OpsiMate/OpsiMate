import { AiSettings } from '@/components/Settings/AiSettings/AiSettings';
import { AiConfig, AiTestResult } from '@OpsiMate/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from './test-utils';

// The query hooks are mocked at the module boundary: these tests are about the form's
// own rules (sync, payloads, disabled states, toasts), not about fetching. The mutation
// functions are shared vi.fn()s so each test can set their outcome and assert on calls.
const { configState, pendingState, updateMutateAsync, updateMutate, testMutateAsync, toastMock } = vi.hoisted(() => ({
	configState: { current: null as AiConfig | null },
	pendingState: { save: false, test: false },
	updateMutateAsync: vi.fn(),
	updateMutate: vi.fn(),
	testMutateAsync: vi.fn(),
	toastMock: vi.fn(),
}));

vi.mock('@/hooks/queries/ai', () => ({
	useAiConfig: () => ({ data: configState.current, isLoading: false, error: null }),
	useUpdateAiConfig: () => ({ mutateAsync: updateMutateAsync, mutate: updateMutate, isPending: pendingState.save }),
	useTestAiConnection: () => ({ mutateAsync: testMutateAsync, isPending: pendingState.test }),
}));

// AiSettings imports '@/components/ui/use-toast', which re-exports this module.
vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast: toastMock }),
	toast: toastMock,
}));

interface UpdateMutateOptions {
	onError?: (error: unknown) => void;
}

const MODEL_ID = 'anthropic.claude-sonnet-4-5-20250929-v1:0';
const DIRTY_TITLE = 'Save your changes first — the test runs with the saved settings';
const UNSAVED_NOTE = 'Unsaved changes — Test connection uses the saved settings.';

const config = (overrides: Partial<AiConfig> = {}): AiConfig => ({
	provider: 'bedrock',
	region: 'us-east-1',
	modelId: MODEL_ID,
	baseUrl: '',
	enabled: true,
	hasApiKey: true,
	updatedAt: null,
	...overrides,
});

const testResult = (overrides: Partial<AiTestResult> = {}): AiTestResult => ({
	ok: true,
	modelId: 'm1',
	latencyMs: 42,
	message: 'hi',
	...overrides,
});

const field = (label: string): HTMLInputElement => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const saveButton = () => screen.getByRole('button', { name: /^save$/i });
const testButton = () => screen.getByRole('button', { name: /test connection/i });
const enableSwitch = () => screen.getByRole('switch', { name: 'Enable AI features' });

const showTestResult = async (result: AiTestResult) => {
	testMutateAsync.mockResolvedValueOnce(result);
	fireEvent.click(testButton());
	await screen.findByText(result.message);
};

beforeEach(() => {
	configState.current = config();
	pendingState.save = false;
	pendingState.test = false;
	updateMutateAsync.mockReset().mockResolvedValue(undefined);
	updateMutate.mockReset();
	testMutateAsync.mockReset();
	toastMock.mockReset();
});

describe('AiSettings', () => {
	test('while saving the button reads "Saving…" and is disabled', () => {
		pendingState.save = true;
		render(<AiSettings />);
		expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
	});

	test('when idle the button reads "Save"', () => {
		render(<AiSettings />);
		expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
	});

	test('a refetch refreshes untouched fields but keeps unsaved edits', () => {
		const { rerender } = render(<AiSettings />);
		type('AWS region', 'eu-west-1');

		configState.current = config({ modelId: 'amazon.nova-pro-v1:0' });
		rerender(<AiSettings />);

		expect(field('AWS region').value).toBe('eu-west-1');
		expect(field('Model id').value).toBe('amazon.nova-pro-v1:0');
	});

	test('Save sends trimmed values and omits the key when the key field is empty', async () => {
		render(<AiSettings />);
		type('AWS region', '  eu-west-1  ');
		fireEvent.click(saveButton());

		await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
		expect(updateMutateAsync.mock.calls[0][0]).toEqual({ region: 'eu-west-1', modelId: MODEL_ID, baseUrl: '' });
	});

	test('Save sends a typed key and clears the key field afterwards', async () => {
		render(<AiSettings />);
		type('Bedrock API key', 'new-key');
		fireEvent.click(saveButton());

		await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
		expect(updateMutateAsync.mock.calls[0][0]).toEqual({
			region: 'us-east-1',
			modelId: MODEL_ID,
			baseUrl: '',
			apiKey: 'new-key',
		});
		await waitFor(() => expect(field('Bedrock API key').value).toBe(''));
	});

	test('a successful Save toasts "AI settings saved"', async () => {
		render(<AiSettings />);
		type('AWS region', 'eu-west-1');
		fireEvent.click(saveButton());

		await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'AI settings saved' }));
	});

	test('a failed Save toasts the error as destructive', async () => {
		updateMutateAsync.mockRejectedValueOnce(new Error('boom'));
		render(<AiSettings />);
		type('AWS region', 'eu-west-1');
		fireEvent.click(saveButton());

		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith({
				title: 'Failed to save',
				description: 'boom',
				variant: 'destructive',
			})
		);
	});

	test('Remove key sends exactly { apiKey: null, enabled: false } and toasts', async () => {
		render(<AiSettings />);
		fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));

		await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
		expect(updateMutateAsync.mock.calls[0][0]).toEqual({ apiKey: null, enabled: false });
		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'API key removed' }))
		);
	});

	test('a failed Remove key toasts the error as destructive', async () => {
		updateMutateAsync.mockRejectedValueOnce(new Error('nope'));
		render(<AiSettings />);
		fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));

		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith({
				title: 'Failed to remove key',
				description: 'nope',
				variant: 'destructive',
			})
		);
	});

	test('there is no Remove key button without a saved key', () => {
		configState.current = config({ hasApiKey: false, enabled: false });
		render(<AiSettings />);
		expect(screen.queryByRole('button', { name: 'Remove key' })).not.toBeInTheDocument();
	});

	test('without a saved key the switch and Test connection are disabled', () => {
		configState.current = config({ hasApiKey: false, enabled: false });
		render(<AiSettings />);
		expect(enableSwitch()).toBeDisabled();
		expect(testButton()).toBeDisabled();
	});

	test('with a key and no changes the switch and Test connection are enabled and Save is disabled', () => {
		render(<AiSettings />);
		expect(enableSwitch()).toBeEnabled();
		expect(testButton()).toBeEnabled();
		expect(testButton()).not.toHaveAttribute('title');
		expect(saveButton()).toBeDisabled();
		expect(screen.queryByText(UNSAVED_NOTE)).not.toBeInTheDocument();
	});

	test('unsaved edits disable Test connection, explain why and enable Save', () => {
		render(<AiSettings />);
		type('Model id', 'amazon.nova-lite-v1:0');

		expect(testButton()).toBeDisabled();
		expect(testButton()).toHaveAttribute('title', DIRTY_TITLE);
		expect(screen.getByText(UNSAVED_NOTE)).toBeInTheDocument();
		expect(saveButton()).toBeEnabled();
	});

	test('the unsaved-changes note is not shown without a saved key', () => {
		configState.current = config({ hasApiKey: false, enabled: false });
		render(<AiSettings />);
		type('AWS region', 'eu-west-1');
		expect(screen.queryByText(UNSAVED_NOTE)).not.toBeInTheDocument();
	});

	test('the switch sends { enabled } and toasts "Failed to update" on error', () => {
		render(<AiSettings />);
		fireEvent.click(enableSwitch());

		expect(updateMutate).toHaveBeenCalledTimes(1);
		expect(updateMutate.mock.calls[0][0]).toEqual({ enabled: false });

		const options = updateMutate.mock.calls[0][1] as UpdateMutateOptions;
		options.onError?.(new Error('denied'));
		expect(toastMock).toHaveBeenCalledWith({
			title: 'Failed to update',
			description: 'denied',
			variant: 'destructive',
		});
	});

	test('a successful test shows the model, latency and reply', async () => {
		render(<AiSettings />);
		await showTestResult(testResult());
		expect(screen.getByText('Connected — m1 answered in 42ms')).toBeInTheDocument();
	});

	test('a failed test shows "Connection failed" and the error', async () => {
		render(<AiSettings />);
		await showTestResult(testResult({ ok: false, message: 'bad key' }));
		expect(screen.getByText('Connection failed')).toBeInTheDocument();
	});

	test('a test call that throws shows no result and toasts "Test failed to run"', async () => {
		testMutateAsync.mockRejectedValueOnce(new Error('network'));
		render(<AiSettings />);
		fireEvent.click(testButton());

		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith(
				expect.objectContaining({ title: 'Test failed to run', variant: 'destructive' })
			)
		);
		expect(screen.queryByText('Connection failed')).not.toBeInTheDocument();
		expect(screen.queryByText(/^Connected —/)).not.toBeInTheDocument();
	});

	test('a successful Save hides the previous test result', async () => {
		render(<AiSettings />);
		await showTestResult(testResult());

		type('AWS region', 'eu-west-1');
		fireEvent.click(saveButton());

		await waitFor(() => expect(screen.queryByText('hi')).not.toBeInTheDocument());
	});

	test('Remove key hides the previous test result', async () => {
		render(<AiSettings />);
		await showTestResult(testResult());

		fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));

		await waitFor(() => expect(screen.queryByText('hi')).not.toBeInTheDocument());
	});
});
