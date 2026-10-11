import { AlertComment } from '@OpsiMate/shared';
import { describe, expect, test, vi } from 'vitest';
import { CommentItem } from '@/components/Alerts/AlertDetails/CommentsWall/CommentItem';
import { AlertDetailsHeader } from '@/components/Alerts/AlertDetails/AlertDetailsHeader';
import { GroupByControls } from '@/components/Alerts/AlertsTable/GroupByControls';
import { ColumnSettingsDropdown } from '@/components/Alerts/AlertsTable/ColumnSettingsDropdown/ColumnSettingsDropdown';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DashboardsFilter } from '@/components/Dashboards/DashboardsFilter/DashboardsFilter';
import { DashboardRow } from '@/components/Dashboards/DashboardRow';
import { DashboardWithFavorite } from '@/components/Dashboards/Dashboards.types';
import { LeftSidebar } from '@/components/LeftSidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { integrationApi } from '@/lib/api';
import Integrations from '@/pages/Integrations';
import { act, fireEvent, render, screen } from './test-utils';

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

describe('sidebar community links', () => {
	test('exposes the sidebar community actions as named links', () => {
		render(<LeftSidebar collapsed={false} />);

		const slack = screen.getByRole('link', { name: 'Join our Slack community' });
		expect(slack).toHaveAttribute(
			'href',
			'https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA'
		);
		expect(slack).toHaveAttribute('target', '_blank');
		expect(slack).toHaveAttribute('rel', 'noopener noreferrer');

		const github = screen.getByRole('link', { name: 'Star OpsiMate on GitHub' });
		expect(github).toHaveAttribute('href', 'https://github.com/opsimate/opsimate');
		expect(github).toHaveAttribute('target', '_blank');
		expect(github).toHaveAttribute('rel', 'noopener noreferrer');
	});
});

test('links to the API documentation on this server', () => {
	render(<LeftSidebar collapsed={false} />);

	const link = screen.getByRole('link', { name: 'Open the API documentation' });
	expect(link.getAttribute('href')).toMatch(/\/api\/docs\/$/);
	expect(link).toHaveAttribute('target', '_blank');
});

test('updates the sidebar toggle name when its state changes', () => {
	localStorage.removeItem('sidebarCollapsed');
	render(
		<DashboardLayout>
			<div />
		</DashboardLayout>
	);

	const collapseButton = screen.getByRole('button', { name: 'Collapse sidebar' });
	fireEvent.click(collapseButton);

	const expandButton = screen.getByRole('button', { name: 'Expand sidebar' });
	fireEvent.click(expandButton);

	expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
});

test('names the alert grouping control by its action', () => {
	render(<GroupByControls groupByColumns={[]} onGroupByChange={vi.fn()} availableColumns={['status']} />);

	expect(screen.getByRole('button', { name: 'Configure alert grouping' })).toBeInTheDocument();
});

test('names the column settings control', () => {
	render(
		<TooltipProvider>
			<ColumnSettingsDropdown visibleColumns={[]} onColumnToggle={vi.fn()} columnLabels={{ name: 'Name' }} />
		</TooltipProvider>
	);

	expect(screen.getByRole('button', { name: 'Toggle columns' })).toBeInTheDocument();
});

test('names and clears the dashboard search filter', () => {
	const onSearchChange = vi.fn();
	render(
		<DashboardsFilter
			searchTerm="production"
			onSearchChange={onSearchChange}
			availableTags={[]}
			selectedTagIds={[]}
			onTagToggle={vi.fn()}
			onClearTagFilters={vi.fn()}
			onCreateDashboard={vi.fn()}
		/>
	);

	fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

	expect(onSearchChange).toHaveBeenCalledWith('');
});

test('names the documentation action with its integration', async () => {
	vi.spyOn(integrationApi, 'getIntegrations').mockResolvedValue({
		success: false,
		error: 'Not needed for this accessibility test',
	});
	await act(async () => {
		render(<Integrations />);
	});

	expect(screen.getByRole('button', { name: 'Open Google Cloud Platform documentation' })).toBeInTheDocument();
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
