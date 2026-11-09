import { AlertHistoryWall } from '@/components/Alerts/AlertDetails/AlertHistoryWall';
import { AlertHistoryQueryState } from '@/components/Alerts/AlertDetails/hooks';
import { AlertHistoryData, AlertHistoryEventType, AlertStatus } from '@OpsiMate/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { render } from './test-utils';

const entry = (overrides: Partial<AlertHistoryData>): AlertHistoryData => ({
	date: '2026-11-01T10:00:00Z',
	status: AlertStatus.FIRING,
	eventType: AlertHistoryEventType.STATUS_CHANGED,
	description: 'Alert started firing',
	...overrides,
});

const state = (overrides: Partial<AlertHistoryQueryState>): AlertHistoryQueryState => ({
	data: null,
	isLoading: false,
	isError: false,
	...overrides,
});

describe('AlertHistoryWall', () => {
	test('says it is loading while the query is in flight', () => {
		render(<AlertHistoryWall history={state({ isLoading: true })} />);

		expect(screen.getByText('Loading history...')).toBeInTheDocument();
	});

	test('a failed fetch is reported, not shown as loading forever', () => {
		render(<AlertHistoryWall history={state({ isError: true })} />);

		expect(screen.getByText(/couldn't load history/i)).toBeInTheDocument();
		expect(screen.queryByText('Loading history...')).not.toBeInTheDocument();
	});

	test('an alert with no history shows the empty state and disables export', () => {
		render(<AlertHistoryWall history={state({ data: { alertId: 'a', data: [] } })} />);

		expect(screen.getByText('No alert history available')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /export history/i })).toBeDisabled();
	});

	test('entries render in the timeline with a count badge and the lane filter narrows them', () => {
		const data = [
			entry({}),
			entry({
				date: '2026-11-02T10:00:00Z',
				eventType: AlertHistoryEventType.SILENCED,
				description: 'Alert silenced',
			}),
		];
		render(<AlertHistoryWall history={state({ data: { alertId: 'a', data } })} />);

		expect(screen.getByText('2')).toBeInTheDocument();
		expect(screen.getByText('Alert started firing')).toBeInTheDocument();
		expect(screen.getByText('Alert silenced')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /export history/i })).toBeEnabled();

		fireEvent.click(screen.getByRole('button', { name: 'Status', pressed: false }));

		expect(screen.getByText('Alert started firing')).toBeInTheDocument();
		expect(screen.queryByText('Alert silenced')).not.toBeInTheDocument();
		expect(screen.getByText('1')).toBeInTheDocument();
	});
});
