import { Alert } from '@OpsiMate/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AlertInfoSection } from '@/components/Alerts/AlertDetails/AlertInfoSection/AlertInfoSection';
import { TooltipProvider } from '@/components/ui/tooltip';
import { render } from './test-utils';

// The drawer's owner picker always called the ACTIVE endpoint, which 404s for an alert in
// the resolved list: the optimistic change rolled back and the owner silently never
// changed. It now picks the endpoint the way the table's owner column does.

const setAlertOwner = vi.fn();
const setResolvedAlertOwner = vi.fn();
vi.mock('@/lib/api', () => ({
	alertsApi: {
		setAlertOwner: (id: string, ownerId: string | null) => setAlertOwner(id, ownerId),
		setResolvedAlertOwner: (id: string, ownerId: string | null) => setResolvedAlertOwner(id, ownerId),
	},
}));

vi.mock('@/hooks/queries/users', () => ({
	useUsers: () => ({ data: [] }),
}));

interface MockPersonPickerProps {
	onSelect: (userId: string | null) => void;
}

// The real picker is a searchable popover; the test only needs its onSelect.
vi.mock('@/components/PersonPicker', () => ({
	PersonPicker: ({ onSelect }: MockPersonPickerProps) => (
		<button type="button" onClick={() => onSelect('7')}>
			pick owner
		</button>
	),
}));

const mkAlert = (overrides: Partial<Alert> = {}): Alert =>
	({
		id: 'a1',
		alertName: 'Disk almost full',
		type: 'Grafana',
		status: 'firing',
		severity: 'warning',
		tags: {},
		startsAt: new Date(0).toISOString(),
		updatedAt: new Date(0).toISOString(),
		isSilenced: false,
		ownerId: null,
		...overrides,
	}) as unknown as Alert;

const pickOwner = (alert: Alert, isResolved?: boolean) => {
	render(
		<TooltipProvider>
			<AlertInfoSection alert={alert} isResolved={isResolved} />
		</TooltipProvider>
	);
	fireEvent.click(screen.getByRole('button', { name: 'pick owner' }));
};

const ok = { success: true, data: { alert: mkAlert({ ownerId: '7' }) } };

beforeEach(() => {
	setAlertOwner.mockReset().mockResolvedValue(ok);
	setResolvedAlertOwner.mockReset().mockResolvedValue(ok);
});

describe('AlertInfoSection owner picker', () => {
	test('an active alert is assigned through the active endpoint', async () => {
		pickOwner(mkAlert());

		await waitFor(() => expect(setAlertOwner).toHaveBeenCalledWith('a1', '7'));
		expect(setResolvedAlertOwner).not.toHaveBeenCalled();
	});

	test('a resolved alert (the panel says so) is assigned through the resolved endpoint', async () => {
		pickOwner(mkAlert({ status: 'resolved' } as Partial<Alert>), true);

		await waitFor(() => expect(setResolvedAlertOwner).toHaveBeenCalledWith('a1', '7'));
		expect(setAlertOwner).not.toHaveBeenCalled();
	});

	test('a resolved row of the combined "All" view (isResolved on the alert) uses the resolved endpoint', async () => {
		pickOwner(mkAlert({ isResolved: true }));

		await waitFor(() => expect(setResolvedAlertOwner).toHaveBeenCalledWith('a1', '7'));
		expect(setAlertOwner).not.toHaveBeenCalled();
	});
});
