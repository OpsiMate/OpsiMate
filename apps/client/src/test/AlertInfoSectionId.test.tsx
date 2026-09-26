import { Alert } from '@OpsiMate/shared';
import { screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AlertInfoSection } from '@/components/Alerts/AlertDetails/AlertInfoSection';
import { TooltipProvider } from '@/components/ui/tooltip';
import { render } from './test-utils';

vi.mock('@/hooks/queries/users', () => ({ useUsers: () => ({ data: [] }) }));
vi.mock('@/hooks/queries/alerts', () => ({ useSetAlertOwner: () => ({ mutate: vi.fn() }) }));

const alert = {
	id: 'grafana-8f3a1c-disk-full-node-7',
	alertName: 'Disk full on node 7',
	type: 'Grafana',
	status: 'firing',
	severity: 'critical',
	tags: {},
	startsAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
	createdAt: new Date(0).toISOString(),
	isSilenced: false,
	ownerId: null,
} as unknown as Alert;

describe('AlertInfoSection — alert id', () => {
	test('shows the alert id under the name, small and selectable', () => {
		render(
			<TooltipProvider>
				<AlertInfoSection alert={alert} />
			</TooltipProvider>
		);
		const id = screen.getByText('grafana-8f3a1c-disk-full-node-7');
		expect(id).toHaveClass('select-all');
		expect(id.closest('p')).toHaveClass('text-xs', 'text-muted-foreground');
		expect(id.closest('p')).not.toHaveClass('font-semibold');
		expect(screen.getByRole('heading', { name: 'Disk full on node 7' })).toBeInTheDocument();
	});
});
