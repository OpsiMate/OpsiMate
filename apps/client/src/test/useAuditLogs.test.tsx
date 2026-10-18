import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { AuditActionType, AuditLog, AuditResourceType } from '@OpsiMate/shared';
import { useAuditLogs } from '@/hooks/queries/audit/useAuditLogs';
import { auditApi } from '@/lib/api';
import { renderHook, waitFor } from './test-utils';

vi.mock('@/lib/api', () => ({
	auditApi: {
		getAuditLogs: vi.fn(),
	},
}));

type AuditResponse = Awaited<ReturnType<typeof auditApi.getAuditLogs>>;

const auditLog = (id: number): AuditLog => ({
	id,
	timestamp: '2026-10-18T10:00:00.000Z',
	actionType: AuditActionType.CREATE,
	resourceType: AuditResourceType.PROVIDER,
	resourceId: String(id),
	userId: id,
	resourceName: `Resource ${id}`,
	userName: `user${id}@example.com`,
});

const page = (id: number): AuditResponse => ({
	success: true,
	data: { logs: [auditLog(id)], total: 2 },
});

const wrapper = ({ children }: { children: ReactNode }) => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
		},
	});

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('useAuditLogs', () => {
	test('keeps the previous page data while the next page is loading', async () => {
		const mockedGetAuditLogs = vi.mocked(auditApi.getAuditLogs);
		let resolvePage2: ((value: AuditResponse) => void) | undefined;

		mockedGetAuditLogs.mockImplementation((pageNumber) => {
			if (pageNumber === 1) {
				return Promise.resolve(page(1));
			}

			return new Promise<AuditResponse>((resolve) => {
				resolvePage2 = resolve;
			});
		});

		const { result, rerender } = renderHook(
			({ pageNumber }: { pageNumber: number }) => useAuditLogs(pageNumber, 10),
			{ wrapper, initialProps: { pageNumber: 1 } }
		);

		await waitFor(() => expect(result.current.data?.logs[0]?.id).toBe(1));
		expect(result.current.isPlaceholderData).toBe(false);

		rerender({ pageNumber: 2 });

		// Page 2 is still in flight; the rows from page 1 must stay on screen.
		expect(result.current.data?.logs[0]?.id).toBe(1);
		expect(result.current.isPlaceholderData).toBe(true);

		await waitFor(() => expect(resolvePage2).toBeDefined());
		resolvePage2?.(page(2));

		await waitFor(() => expect(result.current.data?.logs[0]?.id).toBe(2));
		expect(result.current.isPlaceholderData).toBe(false);
	});
});
