import { Alert, AlertSeverity, AlertStatus, Role } from '@OpsiMate/shared';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserRole } from '@/lib/auth';
import { RowActions } from './RowActions';

vi.mock('@/lib/auth', () => ({ getUserRole: vi.fn() }));

const alert: Alert = {
	id: 'alert-1',
	type: 'Custom',
	status: AlertStatus.RESOLVED,
	severity: AlertSeverity.WARNING,
	tags: {},
	startsAt: '2026-10-19T00:00:00.000Z',
	updatedAt: '2026-10-19T00:00:00.000Z',
	alertUrl: '',
	alertName: 'Test alert',
	createdAt: '2026-10-19T00:00:00.000Z',
	isSilenced: false,
	isResolved: true,
};

describe('RowActions permissions', () => {
	beforeEach(() => {
		vi.mocked(getUserRole).mockReset();
	});
	it('shows Delete for admins on resolved alerts', async () => {
		const user = userEvent.setup();
		vi.mocked(getUserRole).mockReturnValue(Role.Admin);
		render(<RowActions alert={alert} onDeleteAlert={vi.fn()} />);
		await user.click(screen.getByRole('button', { name: 'More actions' }));
		expect(await screen.findByText('Delete')).toBeInTheDocument();
	});
	it('hides Delete for editors on resolved alerts', async () => {
		const user = userEvent.setup();
		vi.mocked(getUserRole).mockReturnValue(Role.Editor);
		render(<RowActions alert={alert} onDeleteAlert={vi.fn()} onUnresolveAlert={vi.fn()} />);
		await user.click(screen.getByRole('button', { name: 'More actions' }));
		expect(await screen.findByText('Unresolve')).toBeInTheDocument();
		expect(screen.queryByText('Delete')).not.toBeInTheDocument();
	});
	it('keeps Resolve visible for editors on active alerts', async () => {
		const user = userEvent.setup();
		vi.mocked(getUserRole).mockReturnValue(Role.Editor);
		render(<RowActions alert={{ ...alert, isResolved: false }} onDeleteAlert={vi.fn()} onSilenceAlert={vi.fn()} />);
		await user.click(screen.getByRole('button', { name: 'More actions' }));
		expect(await screen.findByText('Resolve')).toBeInTheDocument();
	});
});
