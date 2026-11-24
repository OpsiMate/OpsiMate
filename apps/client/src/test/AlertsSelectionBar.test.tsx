import { Alert, AlertSeverity, AlertStatus, Role } from '@OpsiMate/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
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

describe('AlertsSelectionBar incident action', () => {
	test('shows the incident button only when the parent offers it, following the in-flight restriction', () => {
		(getUserRole as ReturnType<typeof vi.fn>).mockReturnValue(Role.Editor);
		const { rerender } = render(
			<AlertsSelectionBar selectedAlerts={[alert('a1')]} onClearSelection={noop} onSilenceAll={noop} />
		);
		expect(screen.queryByRole('button', { name: /^Incident$/ })).toBeNull();
		rerender(
			<AlertsSelectionBar
				selectedAlerts={[alert('a1')]}
				onClearSelection={noop}
				onSilenceAll={noop}
				onGroupIntoIncident={noop}
				actionsDisabled
			/>
		);
		expect(screen.getByRole('button', { name: /^Incident$/ })).toBeDisabled();
	});
});

describe('AlertsSelectionBar with auto-fixed alerts in the selection', () => {
	const withFix = (id: string, fix?: string): Alert => ({
		...alert(id),
		isResolved: false,
		tags: fix ? { fix } : {},
	});
	const renderMixed = (alerts: Alert[], onResolveAll = () => {}) =>
		render(
			<TooltipProvider delayDuration={0}>
				<AlertsSelectionBar
					selectedAlerts={alerts}
					onClearSelection={noop}
					onSilenceAll={noop}
					onResolveAll={onResolveAll}
					onCommentAll={noop}
				/>
			</TooltipProvider>
		);

	beforeEach(() => {
		vi.mocked(getUserRole).mockReturnValue(Role.Admin);
	});

	test('one auto-fixed alert disables Resolve for the whole selection and says which to unselect', async () => {
		const user = userEvent.setup();
		const onResolveAll = vi.fn();
		renderMixed([withFix('a1', 'manual'), withFix('a2', 'auto'), withFix('a3')], onResolveAll);
		const resolve = screen.getByRole('button', { name: 'Resolve' });
		expect(resolve).toBeDisabled();
		await user.click(resolve);
		expect(onResolveAll).not.toHaveBeenCalled();
		await user.hover(resolve.parentElement as HTMLElement);
		expect(await screen.findByRole('tooltip')).toHaveTextContent(
			'1 of the selected alerts is fixed automatically; unselect it to resolve the rest'
		);
		// The other actions are unaffected.
		expect(screen.getByRole('button', { name: 'Silence' })).toBeEnabled();
		expect(screen.getByRole('button', { name: 'Comment' })).toBeEnabled();
	});

	test('all auto-fixed: disabled too, worded for the whole selection', async () => {
		const user = userEvent.setup();
		renderMixed([withFix('a1', 'auto'), withFix('a2', 'autofix')]);
		const resolve = screen.getByRole('button', { name: 'Resolve' });
		expect(resolve).toBeDisabled();
		await user.hover(resolve.parentElement as HTMLElement);
		expect(await screen.findByRole('tooltip')).toHaveTextContent(
			'These alerts are fixed automatically; only the source can resolve them'
		);
	});

	test('no auto-fixed alert: Resolve works as before', async () => {
		const user = userEvent.setup();
		const onResolveAll = vi.fn();
		renderMixed([withFix('a1', 'manual'), withFix('a2')], onResolveAll);
		await user.click(screen.getByRole('button', { name: 'Resolve' }));
		expect(onResolveAll).toHaveBeenCalledTimes(1);
	});
});
