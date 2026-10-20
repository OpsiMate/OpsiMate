import { Alert } from '@OpsiMate/shared';
import { screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AlertsSelectionBar } from '@/components/Alerts/AlertsSelectionBar/AlertsSelectionBar';
import { render } from './test-utils';

vi.mock('@/hooks/queries/users', () => ({
	useUsers: () => ({ data: [] }),
}));

// While a bulk action is running its rows already show the result, but a second action
// started before it settles could be undone by the first one's rollback or refetch, so
// the bar's actions are disabled until it does.

const alert = (id: string): Alert => ({ id, isSilenced: false }) as Alert;

const noop = () => {};

const renderBar = (actionsDisabled?: boolean) =>
	render(
		<AlertsSelectionBar
			selectedAlerts={[alert('a1'), alert('a2')]}
			onClearSelection={noop}
			onSilenceAll={noop}
			onAssignOwnerAll={noop}
			onResolveAll={noop}
			onCommentAll={noop}
			onDeleteAll={noop}
			actionsDisabled={actionsDisabled}
		/>
	);

const actionButtons = () =>
	['Assign Owner', 'Silence', 'Resolve', 'Comment', 'Delete'].map((name) =>
		screen.getByRole('button', { name: new RegExp(name) })
	);

describe('AlertsSelectionBar while a bulk action runs', () => {
	test('every action is enabled when nothing is running', () => {
		renderBar();

		for (const button of actionButtons()) expect(button).toBeEnabled();
		expect(screen.queryByText(/Finishing the previous action/)).not.toBeInTheDocument();
	});

	test('every action is disabled, with a note, while one is running; clearing stays available', () => {
		renderBar(true);

		for (const button of actionButtons()) expect(button).toBeDisabled();
		expect(screen.getByText(/Finishing the previous action/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Clear selection' })).toBeEnabled();
	});
});
