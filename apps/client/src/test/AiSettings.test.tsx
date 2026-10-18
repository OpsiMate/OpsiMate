import { AiSettings } from '@/components/Settings/AiSettings/AiSettings';
import { AiConfig } from '@OpsiMate/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from './test-utils';

// The query hooks are mocked at the module boundary: this test is about the Save
// button's busy state (spinner + label), not about fetching.
const { configState, pendingState } = vi.hoisted(() => ({
	configState: { current: null as AiConfig | null },
	pendingState: { save: false },
}));

vi.mock('@/hooks/queries/ai', () => ({
	useAiConfig: () => ({ data: configState.current, isLoading: false, error: null }),
	useUpdateAiConfig: () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: pendingState.save }),
	useTestAiConnection: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const config = (overrides: Partial<AiConfig> = {}): AiConfig => ({
	provider: 'bedrock',
	region: 'us-east-1',
	modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
	baseUrl: '',
	enabled: true,
	hasApiKey: true,
	updatedAt: null,
	...overrides,
});

beforeEach(() => {
	configState.current = config();
	pendingState.save = false;
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
});
