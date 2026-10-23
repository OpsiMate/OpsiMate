import { Alert, AlertStatus } from '@OpsiMate/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AlertDetailsPanel } from '@/components/Alerts/AlertDetails/AlertDetailsPanel/AlertDetailsPanel';
import { render } from './test-utils';

// The stub echoes the alert id it was handed, which is what proves the wall is showing the
// newly selected alert rather than the previous one.
interface MockCommentsWallProps {
	alertId: string;
}

// The panel's body, footer and comment wall all fetch; stub them out so this test is about
// tab behavior alone.
// The body stub echoes isResolved, which is what proves the panel tells the owner picker
// which endpoint to use.
interface MockAlertDetailsBodyProps {
	isResolved?: boolean;
}

vi.mock('@/components/Alerts/AlertDetails/AlertDetailsBody', () => ({
	AlertDetailsBody: ({ isResolved }: MockAlertDetailsBodyProps) => (
		<div>{isResolved ? 'details-body:resolved' : 'details-body'}</div>
	),
}));
vi.mock('@/components/Alerts/AlertDetails/AlertFooterActions', () => ({
	AlertFooterActions: () => <div>footer-actions</div>,
}));
vi.mock('@/components/Alerts/AlertDetails/CommentsWall', () => ({
	CommentsWall: ({ alertId }: MockCommentsWallProps) => <div>{`comments-wall:${alertId}`}</div>,
}));
vi.mock('@/components/Alerts/AlertDetails/hooks', () => ({
	useAlertHistory: () => null,
}));

const mkAlert = (id: string): Alert =>
	({
		id,
		alertName: `alert ${id}`,
		type: 'Grafana',
		status: 'firing',
		severity: 'info',
		tags: {},
		startsAt: new Date(0).toISOString(),
		updatedAt: new Date(0).toISOString(),
		createdAt: new Date(0).toISOString(),
		isSilenced: false,
	}) as unknown as Alert;

const noop = () => {};

// Radix activates a tab on mousedown, not click.
const openComments = () => fireEvent.mouseDown(screen.getByRole('tab', { name: /comments/i }));

describe('AlertDetailsPanel tab reset', () => {
	test('selecting a different alert returns to Details', () => {
		const { rerender } = render(<AlertDetailsPanel alert={mkAlert('a')} isActive onClose={noop} />);

		openComments();
		expect(screen.getByText('comments-wall:a')).toBeInTheDocument();

		rerender(<AlertDetailsPanel alert={mkAlert('b')} isActive onClose={noop} />);

		expect(screen.getByText('details-body')).toBeInTheDocument();
		expect(screen.queryByText('comments-wall:b')).not.toBeInTheDocument();
	});

	test('the same alert re-rendering (polling) keeps the open tab', () => {
		const { rerender } = render(<AlertDetailsPanel alert={mkAlert('a')} isActive onClose={noop} />);

		openComments();
		expect(screen.getByText('comments-wall:a')).toBeInTheDocument();

		// Same id, fresh object — an alerts refetch must not yank the user off Comments.
		rerender(
			<AlertDetailsPanel alert={{ ...mkAlert('a'), status: AlertStatus.RESOLVED }} isActive onClose={noop} />
		);

		expect(screen.getByText('comments-wall:a')).toBeInTheDocument();
	});
});

describe('AlertDetailsPanel resolved state', () => {
	test('a resolved alert (isActive false) is passed to the body as resolved', () => {
		render(<AlertDetailsPanel alert={mkAlert('a')} isActive={false} onClose={noop} />);

		expect(screen.getByText('details-body:resolved')).toBeInTheDocument();
	});

	test('an active alert is not', () => {
		render(<AlertDetailsPanel alert={mkAlert('a')} isActive onClose={noop} />);

		expect(screen.getByText('details-body')).toBeInTheDocument();
	});
});

// The handle moved into the shared components, so the details panel gets the keyboard resize
// the filter sidebar was built for — including its own storage key and its own bounds.
describe('AlertDetailsPanel resize handle', () => {
	test('arrow keys widen the panel and remember it under the details-panel key', () => {
		localStorage.clear();
		render(<AlertDetailsPanel alert={mkAlert('a')} isActive onClose={noop} />);

		const handle = screen.getByRole('separator', { name: 'Resize alert details panel' });
		expect(handle).toHaveAttribute('tabindex', '0');
		expect(handle).toHaveAttribute('aria-valuenow', '340');

		fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
		expect(handle).toHaveAttribute('aria-valuenow', '404');
		expect(localStorage.getItem('opsimate-alert-details-panel-width')).toBe('404');

		fireEvent.keyDown(handle, { key: 'End' });
		expect(handle).toHaveAttribute('aria-valuenow', '640');
	});
});
