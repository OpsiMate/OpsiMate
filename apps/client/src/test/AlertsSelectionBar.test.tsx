import { Alert, AlertSeverity, AlertStatus, Role } from '@OpsiMate/shared';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getUserRole } from '@/lib/auth';
import { AlertsSelectionBar } from '@/components/Alerts/AlertsSelectionBar/AlertsSelectionBar';

vi.mock('@/lib/auth', () => ({ getUserRole: vi.fn(), getCurrentUser: vi.fn(() => null) }));

vi.mock('@/hooks/queries/users', () => ({
	useUsers: () => ({ data: [] }),
}));

const alert = (id: string): Alert => ({
	id,
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
});

const noop = () => {};

const renderBar = (actionsDisabled = false, canDelete = true) =>
	render(
		<AlertsSelectionBar
			selectedAlerts={[alert('a1'), alert('a2')]}
			onClearSelection={noop}
			onSilenceAll={noop}
			onAssignOwnerAll={noop}
			onResolveAll={noop}
			onCommentAll={noop}
			onDeleteAll={canDelete ? noop : undefined}
			actionsDisabled={actionsDisabled}
		/>
	);

const actionButtons = () =>
	['Assign Owner', 'Silence', 'Resolve', 'Comment', 'Delete'].map((name) =>
		screen.getByRole('button', { name: new RegExp(name) })
	);

beforeEach(() => {
	vi.resetAllMocks();
});

describe('AlertsSelectionBar delete permissions', () => {
	test('shows Delete for Admin', () => {
		vi.mocked(getUserRole).mockReturnValue(Role.Admin);

		renderBar();

		expect(screen.getByRole('button', { name: /^Delete$/ })).toBeInTheDocument();
	});

	test('hides Delete for Editor', () => {
		vi.mocked(getUserRole).mockReturnValue(Role.Editor);

		renderBar(false, false);

		expect(screen.queryByRole('button', { name: /^Delete$/ })).not.toBeInTheDocument();
	});
});

describe('AlertsSelectionBar while a bulk action runs', () => {
	test('every action is enabled when nothing is running', () => {
		vi.mocked(getUserRole).mockReturnValue(Role.Admin);

		renderBar();

		for (const button of actionButtons()) {
			expect(button).toBeEnabled();
		}

		expect(screen.queryByText(/Finishing the previous action/)).not.toBeInTheDocument();
	});

	test('every action is disabled while one is running; clearing stays available', () => {
		vi.mocked(getUserRole).mockReturnValue(Role.Admin);

		renderBar(true);

		for (const button of actionButtons()) {
			expect(button).toBeDisabled();
		}

		expect(screen.getByText(/Finishing the previous action/)).toBeInTheDocument();

		expect(screen.getByRole('button', { name: 'Clear selection' })).toBeEnabled();
	});
});
