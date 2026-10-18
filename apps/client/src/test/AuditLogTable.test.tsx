import { fireEvent, render, screen } from './test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AuditLogTable } from '@/pages/Settings';
import * as auditHooks from '@/hooks/queries/audit/useAuditLogs';
import { keepPreviousData } from '@tanstack/react-query';

vi.mock('@/hooks/queries/audit/useAuditLogs', () => ({
	useAuditLogs: vi.fn(),
}));

const mockAuditLogs = [
	{
		id: '1',
		timestamp: '2026-10-18T10:00:00.000Z',
		actionType: 'CREATE',
		resourceType: 'Integration',
		resourceName: 'Grafana Prod',
		userName: 'alice@example.com',
	},
	{
		id: '2',
		timestamp: '2026-10-18T11:00:00.000Z',
		actionType: 'DELETE',
		resourceType: 'AlertRule',
		resourceName: 'High CPU Alert',
		userName: 'bob@example.com',
	},
	{
		id: '3',
		timestamp: '2026-10-18T12:00:00.000Z',
		actionType: 'UPDATE',
		resourceType: 'MutePolicy',
		resourceName: 'Night Mute',
		userName: 'charlie@example.com',
	},
];

describe('AuditLogTable', () => {
	const mockedUseAuditLogs = vi.mocked(auditHooks.useAuditLogs);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('renders loading state when query is loading', () => {
		mockedUseAuditLogs.mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
		} as any);

		render(<AuditLogTable />);
		expect(screen.getByText('Loading audit logs...')).toBeInTheDocument();
	});

	test('renders error alert when query fails', () => {
		const errorMessage = 'Network error fetching logs';
		mockedUseAuditLogs.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error(errorMessage),
		} as any);

		render(<AuditLogTable />);
		expect(screen.getByText(errorMessage)).toBeInTheDocument();
	});

	test('renders empty message when no audit logs found', () => {
		mockedUseAuditLogs.mockReturnValue({
			data: { logs: [], total: 0 },
			isLoading: false,
			error: null,
		} as any);

		render(<AuditLogTable />);
		expect(screen.getByText('No audit logs found.')).toBeInTheDocument();
	});

	test('renders table headers and audit log entries with action badges', () => {
		mockedUseAuditLogs.mockReturnValue({
			data: { logs: mockAuditLogs, total: mockAuditLogs.length },
			isLoading: false,
			error: null,
		} as any);

		render(<AuditLogTable />);

		// Headers
		expect(screen.getByText('Time')).toBeInTheDocument();
		expect(screen.getByText('Action')).toBeInTheDocument();
		expect(screen.getByText('Resource')).toBeInTheDocument();
		expect(screen.getByText('Resource Name')).toBeInTheDocument();
		expect(screen.getByText('User')).toBeInTheDocument();

		// Entries
		expect(screen.getByText('Grafana Prod')).toBeInTheDocument();
		expect(screen.getByText('High CPU Alert')).toBeInTheDocument();
		expect(screen.getByText('Night Mute')).toBeInTheDocument();

		expect(screen.getByText('alice@example.com')).toBeInTheDocument();
		expect(screen.getByText('bob@example.com')).toBeInTheDocument();
		expect(screen.getByText('charlie@example.com')).toBeInTheDocument();

		// Badges for actions
		expect(screen.getByText('CREATE')).toBeInTheDocument();
		expect(screen.getByText('DELETE')).toBeInTheDocument();
		expect(screen.getByText('UPDATE')).toBeInTheDocument();
	});

	test('renders pagination buttons and handles page change', () => {
		mockedUseAuditLogs.mockReturnValue({
			data: { logs: mockAuditLogs, total: 30 },
			isLoading: false,
			error: null,
		} as any);

		render(<AuditLogTable />);

		// Total is 30, pageSize default 10 -> 3 pages
		const page2Button = screen.getByRole('button', { name: '2' });
		expect(page2Button).toBeInTheDocument();

		fireEvent.click(page2Button);
		expect(mockedUseAuditLogs).toHaveBeenCalledWith(2, 10);
	});

	test('handles page size change and resets page to 1', () => {
		mockedUseAuditLogs.mockReturnValue({
			data: { logs: mockAuditLogs, total: 50 },
			isLoading: false,
			error: null,
		} as any);

		render(<AuditLogTable />);

		const select = screen.getByLabelText('Items per page:');
		fireEvent.change(select, { target: { value: '20' } });

		expect(mockedUseAuditLogs).toHaveBeenCalledWith(1, 20);
	});
});
