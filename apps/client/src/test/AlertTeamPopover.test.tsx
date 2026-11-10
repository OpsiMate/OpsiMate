import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { OncallTeam } from '@OpsiMate/shared';
import { AlertTeamPopover } from '@/components/Alerts/AlertDetails/AlertTeamPopover';
import { TooltipProvider } from '@/components/ui/tooltip';
import { render } from './test-utils';

const teams = vi.hoisted(() => ({ data: [] as OncallTeam[] }));
vi.mock('@/hooks/queries/oncall', () => ({ useOncallTeams: () => teams }));

const team = (name: string, members: OncallTeam['members']): OncallTeam => ({
	id: 1,
	name,
	rotationIntervalDays: null,
	rotationAnchor: '2026-11-01T00:00:00Z',
	members,
	nextRotationAt: null,
});

// The owning team is a chip in the owner row; its popover shows who is on call and can
// make them the owner.
describe('AlertTeamPopover', () => {
	test('the chip names the team; opening it shows the on-call person and dials', async () => {
		teams.data = [
			team('Payments Platform', [
				{
					userId: '7',
					fullName: 'Dana Levi',
					email: 'dana@example.com',
					phoneNumber: '+972-50-123-4567',
					priority: 1,
				},
				{ userId: '8', fullName: 'Noa Bar', email: 'noa@example.com', phoneNumber: null, priority: 2 },
			]),
		];
		const onAssignOwner = vi.fn();
		render(
			<TooltipProvider>
				<AlertTeamPopover team="payments platform" onAssignOwner={onAssignOwner} />
			</TooltipProvider>
		);
		const chip = screen.getByTestId('alert-team-chip');
		expect(chip).toHaveTextContent('payments platform');
		fireEvent.click(chip);
		await waitFor(() =>
			expect(screen.getByRole('dialog', { name: 'Owning team and on-call' })).toBeInTheDocument()
		);
		expect(screen.getByTestId('alert-team-oncall')).toHaveTextContent('Dana Levi');
		expect(screen.getByRole('link', { name: /\+972-50-123-4567/ })).toHaveAttribute('href', 'tel:+972501234567');
		fireEvent.click(screen.getByRole('button', { name: 'Assign to on-call' }));
		expect(onAssignOwner).toHaveBeenCalledWith('7');
	});

	test('without a schedule it says so and offers no assignment', async () => {
		teams.data = [];
		render(
			<TooltipProvider>
				<AlertTeamPopover team="payments platform" onAssignOwner={vi.fn()} />
			</TooltipProvider>
		);
		fireEvent.click(screen.getByTestId('alert-team-chip'));
		await waitFor(() => expect(screen.getByText('no on-call schedule')).toBeInTheDocument());
		expect(screen.queryByRole('button', { name: 'Assign to on-call' })).toBeNull();
	});
});
