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

describe('RowActions on an auto-fixed alert', () => {
	it('keeps Resolve in the menu but disabled, saying why — for an admin too', async () => {
		const user = userEvent.setup();
		vi.mocked(getUserRole).mockReturnValue(Role.Admin);
		const onDeleteAlert = vi.fn();
		render(
			<RowActions
				alert={{ ...alert, isResolved: false, tags: { fix: 'auto' } }}
				onDeleteAlert={onDeleteAlert}
				onSilenceAlert={vi.fn()}
			/>
		);
		await user.click(screen.getByRole('button', { name: 'More actions' }));
		const resolve = await screen.findByRole('menuitem', { name: /Resolve/ });
		expect(resolve).toHaveAttribute('aria-disabled', 'true');
		// The reason sits on the pointer-enabled wrapper (the disabled item takes no pointer events).
		expect(resolve.closest('[title]')).toHaveAttribute(
			'title',
			'This alert is fixed automatically; only its source can resolve it'
		);
		expect(resolve).toHaveTextContent('auto fix');
		// The reason is visible in the menu itself, not only on hover.
		expect(screen.getByText('This alert is fixed automatically; only its source can resolve it')).toBeVisible();
		await user.click(resolve);
		expect(onDeleteAlert).not.toHaveBeenCalled();
		// Silence is still offered.
		expect(screen.getByRole('menuitem', { name: /Silence/ })).not.toHaveAttribute('aria-disabled', 'true');
	});

	it('a manual-fix alert resolves as before', async () => {
		const user = userEvent.setup();
		vi.mocked(getUserRole).mockReturnValue(Role.Editor);
		const onDeleteAlert = vi.fn();
		render(
			<RowActions
				alert={{ ...alert, isResolved: false, tags: { fix: 'manual' } }}
				onDeleteAlert={onDeleteAlert}
				onSilenceAlert={vi.fn()}
			/>
		);
		await user.click(screen.getByRole('button', { name: 'More actions' }));
		await user.click(await screen.findByRole('menuitem', { name: 'Resolve' }));
		expect(onDeleteAlert).toHaveBeenCalledWith('alert-1');
	});
});
