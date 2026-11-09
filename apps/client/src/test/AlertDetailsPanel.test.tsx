import { Alert, AlertHistory, AlertStatus } from '@OpsiMate/shared';
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
// The history stub echoes the alert id its data carries, proving the tab is fed the
// history of the selected alert (the panel owns the query and hands the result down).
interface MockAlertHistoryWallProps {
	historyData: AlertHistory | null;
}
vi.mock('@/components/Alerts/AlertDetails/AlertHistoryWall', () => ({
	AlertHistoryWall: ({ historyData }: MockAlertHistoryWallProps) => (
		<div>{`history-wall:${historyData?.alertId ?? 'loading'}`}</div>
	),
}));
vi.mock('@/components/Alerts/AlertDetails/hooks', () => ({
	useAlertHistory: (alertId: string): AlertHistory => ({ alertId, data: [] }),
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
const openHistory = () => fireEvent.mouseDown(screen.getByRole('tab', { name: /history/i }));

describe('AlertDetailsPanel tab reset', () => {
	test('selecting a different alert returns to Details', () => {
		const { rerender } = render(<AlertDetailsPanel alert={mkAlert('a')} isActive onClose={noop} />);

		openComments();
		expect(screen.getByText('comments-wall:a')).toBeInTheDocument();

		rerender(<AlertDetailsPanel alert={mkAlert('b')} isActive onClose={noop} />);

		expect(screen.getByText('details-body')).toBeInTheDocument();
		expect(screen.queryByText('comments-wall:b')).not.toBeInTheDocument();
	});

	test("History is its own tab, fed the selected alert's history, and resets with the alert", () => {
		const { rerender } = render(<AlertDetailsPanel alert={mkAlert('a')} isActive onClose={noop} />);

		// Details is the landing tab: no history content until the tab is opened.
		expect(screen.queryByText('history-wall:a')).not.toBeInTheDocument();

		openHistory();
		expect(screen.getByText('history-wall:a')).toBeInTheDocument();
		expect(screen.queryByText('details-body')).not.toBeInTheDocument();

		rerender(<AlertDetailsPanel alert={mkAlert('b')} isActive onClose={noop} />);

		expect(screen.getByText('details-body')).toBeInTheDocument();
		expect(screen.queryByText('history-wall:b')).not.toBeInTheDocument();
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
