import { AlertComment } from '@OpsiMate/shared';
import { describe, expect, test, vi } from 'vitest';
import { CommentItem } from '@/components/Alerts/AlertDetails/CommentsWall/CommentItem';
import { AlertDetailsHeader } from '@/components/Alerts/AlertDetails/AlertDetailsHeader';
import { DashboardRow } from '@/components/Dashboards/DashboardRow';
import { DashboardWithFavorite } from '@/components/Dashboards/Dashboards.types';
import { render, screen } from './test-utils';

const comment: AlertComment = {
	id: 'comment-1',
	alertId: 'alert-1',
	userId: 'user-1',
	comment: 'Investigating the alert.',
	createdAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
};

const dashboard = (isFavorite: boolean): DashboardWithFavorite => ({
	id: 'dashboard-1',
	type: 'alerts',
	name: 'Production alerts',
	filters: {},
	visibleColumns: [],
	query: '',
	groupBy: [],
	isFavorite,
	tags: [],
});

describe('icon-only button accessible names', () => {
	test('names the edit and delete actions on an own comment', () => {
		render(
			<CommentItem
				comment={comment}
				currentUserId="user-1"
				userMap={new Map([['user-1', { fullName: 'Test User', email: 'test@example.com' }]])}
				onEdit={vi.fn()}
				onDelete={vi.fn()}
				isDeleting={false}
				isUpdating={false}
			/>
		);

		expect(screen.getByRole('button', { name: 'Edit comment' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Delete comment' })).toBeInTheDocument();
	});

	test('names the alert details close action', () => {
		render(<AlertDetailsHeader onClose={vi.fn()} />);

		expect(screen.getByRole('button', { name: 'Close details' })).toBeInTheDocument();
	});

	test.each<[boolean, string]>([
		[false, 'Add dashboard to favorites'],
		[true, 'Remove dashboard from favorites'],
	])('names the dashboard favorite action when isFavorite=%s', (isFavorite, label) => {
		render(
			<table>
				<tbody>
					<DashboardRow
						dashboard={dashboard(isFavorite)}
						onClick={vi.fn()}
						onDelete={vi.fn()}
						onToggleFavorite={vi.fn()}
					/>
				</tbody>
			</table>
		);

		expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Delete dashboard' })).toBeInTheDocument();
	});
});
