import { describe, expect, test, vi } from 'vitest';
import { AlertSeverity, AlertStatus, type Alert } from '@OpsiMate/shared';
import { AlertDetailsBottomSections } from '@/components/Alerts/AlertDetails/AlertDetailsBottomSections';
import { render, screen } from './test-utils';

vi.mock('@/hooks/queries/actions', () => ({
	useActions: () => ({ data: [], isLoading: false }),
	usePreviewAction: () => ({ isPending: false, mutateAsync: vi.fn() }),
	useRunAction: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

const alert = (alertUrl: string): Alert => ({
	id: 'a',
	alertName: 'Disk full',
	type: 'Custom',
	status: AlertStatus.FIRING,
	severity: AlertSeverity.CRITICAL,
	tags: {},
	startsAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
	createdAt: new Date(0).toISOString(),
	alertUrl,
	isSilenced: false,
});

// The block pinned above the footer: links (when the alert has any) above the actions.
describe('AlertDetailsBottomSections', () => {
	test('shows Links above Actions when the alert has links', () => {
		render(<AlertDetailsBottomSections alert={alert('https://grafana.example/alert/1')} />);
		const headings = screen.getAllByRole('button', { name: /^(Links|Actions)/ }).map((b) => b.textContent);
		expect(headings[0]).toMatch(/Links/);
		expect(headings[1]).toMatch(/Actions/);
	});

	test('skips Links when there are none; Actions is open by default', () => {
		render(<AlertDetailsBottomSections alert={alert('')} />);
		expect(screen.queryByRole('button', { name: /^Links/ })).toBeNull();
		expect(screen.getByRole('button', { name: /^Actions/ })).toHaveAttribute('aria-expanded', 'true');
	});
});
