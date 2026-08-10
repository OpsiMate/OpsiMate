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
vi.mock('@/components/Alerts/AlertDetails/AlertDetailsBody', () => ({
	AlertDetailsBody: () => <div>details-body</div>,
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
