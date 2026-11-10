import { describe, expect, test, vi } from 'vitest';
import { AlertLastCommentSection } from '@/components/Alerts/AlertDetails/AlertLastCommentSection';
import { render, screen } from './test-utils';

const comments = vi.hoisted(() => ({
	data: [] as { id: number; alertId: string; userId: string; comment: string; createdAt: string }[],
}));
vi.mock('@/hooks/queries/alertComments', () => ({ useAlertComments: () => comments }));
vi.mock('@/hooks/queries/users', () => ({ useUsers: () => ({ data: [{ id: '1', fullName: 'Idan QA' }] }) }));

describe('AlertLastCommentSection', () => {
	test('is open by default and shows the latest comment with its author', () => {
		comments.data = [
			{ id: 1, alertId: 'a', userId: '1', comment: 'older note', createdAt: '2026-11-01T10:00:00Z' },
			{
				id: 2,
				alertId: 'a',
				userId: '1',
				comment: 'Rolled back to 11.08-1, p99 recovering',
				createdAt: '2026-11-02T10:00:00Z',
			},
		];
		render(<AlertLastCommentSection alertId="a" />);
		expect(screen.getByRole('button', { name: /Latest comment/ })).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByText('Rolled back to 11.08-1, p99 recovering')).toBeInTheDocument();
		expect(screen.getByText('Idan QA')).toBeInTheDocument();
		expect(screen.queryByText('older note')).toBeNull();
	});
});
