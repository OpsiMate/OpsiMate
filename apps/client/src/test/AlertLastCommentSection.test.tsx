import { describe, expect, test, vi } from 'vitest';
import { AlertComment } from '@OpsiMate/shared';
import { AlertLastCommentSection } from '@/components/Alerts/AlertDetails/AlertLastCommentSection';
import { render, screen } from './test-utils';

const comments = vi.hoisted(() => ({ data: [] as AlertComment[] }));
const comment = (id: string, text: string, at: string): AlertComment => ({
	id,
	alertId: 'a',
	userId: '1',
	comment: text,
	createdAt: at,
	updatedAt: at,
});
vi.mock('@/hooks/queries/alertComments', () => ({ useAlertComments: () => comments }));
vi.mock('@/hooks/queries/users', () => ({ useUsers: () => ({ data: [{ id: '1', fullName: 'Idan QA' }] }) }));

describe('AlertLastCommentSection', () => {
	test('is open by default and shows the latest comment with its author', () => {
		comments.data = [
			comment('1', 'older note', '2026-11-01T10:00:00Z'),
			comment('2', 'Rolled back to 11.08-1, p99 recovering', '2026-11-02T10:00:00Z'),
		];
		render(<AlertLastCommentSection alertId="a" />);
		expect(screen.getByRole('button', { name: /Latest comment/ })).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByText('Rolled back to 11.08-1, p99 recovering')).toBeInTheDocument();
		expect(screen.getByText('Idan QA')).toBeInTheDocument();
		expect(screen.queryByText('older note')).toBeNull();
	});
});
