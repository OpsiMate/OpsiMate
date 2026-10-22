import { RetentionSettings } from '@/components/Settings/RetentionSettings';
import {
	useRetentionSettings,
	useRunRetention,
	useUpdateRetentionConfig,
	useUpdateRetentionPolicy,
} from '@/hooks/queries/retention/useRetention';
import {
	RetentionConfig,
	RetentionPolicy,
	RetentionResource,
	RetentionSettings as RetentionSettingsData,
} from '@OpsiMate/shared';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from './test-utils';

vi.mock('@/hooks/queries/retention/useRetention');

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast: toastMock }),
	toast: toastMock,
}));

interface MutateCallbacks {
	onSuccess?: () => void;
	onError?: (error: unknown) => void;
}

interface PolicyUpdates {
	enabled?: boolean;
	retentionDays?: number;
}

interface PolicyMutationVariables {
	resourceType: RetentionResource;
	updates: PolicyUpdates;
}

interface ToastArgs {
	title?: string;
	description?: string;
	variant?: string;
}

const config: RetentionConfig = {
	cleanupIntervalHours: 24,
	vacuumAfterCleanup: false,
	lastRunAt: null,
};

const auditPolicy: RetentionPolicy = {
	resourceType: RetentionResource.AuditLogs,
	enabled: true,
	retentionDays: 90,
	updatedAt: '2026-10-01T00:00:00.000Z',
};

const settings: RetentionSettingsData = { config, policies: [auditPolicy] };

const policyMutate = vi.fn<(variables: PolicyMutationVariables, callbacks?: MutateCallbacks) => void>();
const configMutate = vi.fn<(variables: Partial<RetentionConfig>, callbacks?: MutateCallbacks) => void>();

const destructiveToasts = (): ToastArgs[] =>
	toastMock.mock.calls.map(([args]) => args as ToastArgs).filter((args) => args.variant === 'destructive');

beforeEach(() => {
	vi.mocked(useRetentionSettings).mockReturnValue({
		data: settings,
		isLoading: false,
		error: null,
	} as unknown as ReturnType<typeof useRetentionSettings>);
	vi.mocked(useUpdateRetentionPolicy).mockReturnValue({
		mutate: policyMutate,
		isPending: false,
	} as unknown as ReturnType<typeof useUpdateRetentionPolicy>);
	vi.mocked(useUpdateRetentionConfig).mockReturnValue({
		mutate: configMutate,
		isPending: false,
	} as unknown as ReturnType<typeof useUpdateRetentionConfig>);
	vi.mocked(useRunRetention).mockReturnValue({
		mutate: vi.fn(),
		isPending: false,
	} as unknown as ReturnType<typeof useRunRetention>);
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('RetentionSettings toggles', () => {
	test('flipping a policy switch saves the flipped value', () => {
		render(<RetentionSettings />);
		fireEvent.click(screen.getByRole('switch', { name: 'Enable retention for Audit logs' }));

		expect(policyMutate).toHaveBeenCalledWith(
			{ resourceType: 'audit_logs', updates: { enabled: false } },
			expect.objectContaining({ onError: expect.any(Function) })
		);
	});

	test('a failed policy save raises a destructive toast with the server message', () => {
		render(<RetentionSettings />);
		fireEvent.click(screen.getByRole('switch', { name: 'Enable retention for Audit logs' }));

		policyMutate.mock.calls[0][1]?.onError?.(new Error('boom'));

		expect(destructiveToasts()).toEqual([
			expect.objectContaining({ title: 'Failed to save', description: expect.stringContaining('boom') }),
		]);
	});

	test('flipping the reclaim switch saves the flipped value', () => {
		render(<RetentionSettings />);
		fireEvent.click(screen.getByRole('switch', { name: 'Reclaim disk space after cleanup' }));

		expect(configMutate).toHaveBeenCalledWith(
			{ vacuumAfterCleanup: true },
			expect.objectContaining({ onError: expect.any(Function) })
		);
	});

	test('a failed reclaim save raises a destructive toast with the server message', () => {
		render(<RetentionSettings />);
		fireEvent.click(screen.getByRole('switch', { name: 'Reclaim disk space after cleanup' }));

		configMutate.mock.calls[0][1]?.onError?.(new Error('boom'));

		expect(destructiveToasts()).toEqual([
			expect.objectContaining({ title: 'Failed to save', description: expect.stringContaining('boom') }),
		]);
	});

	test('successful toggles raise no destructive toast', () => {
		render(<RetentionSettings />);
		fireEvent.click(screen.getByRole('switch', { name: 'Enable retention for Audit logs' }));
		fireEvent.click(screen.getByRole('switch', { name: 'Reclaim disk space after cleanup' }));

		policyMutate.mock.calls[0][1]?.onSuccess?.();
		configMutate.mock.calls[0][1]?.onSuccess?.();

		expect(destructiveToasts()).toEqual([]);
	});
});
