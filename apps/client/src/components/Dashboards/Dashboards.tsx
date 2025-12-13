import { DashboardLayout } from '@/components/DashboardLayout';
import { useDashboard } from '@/context/DashboardContext';
import { useDeleteDashboard, useGetDashboards } from '@/hooks/queries/dashboards';
import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';
import { useTags } from '@/hooks/queries/tags';
import { useToast } from '@/hooks/use-toast';
import { Tag } from '@OpsiMate/shared';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardsFilter } from './DashboardsFilter';
import { DashboardsHeader } from './DashboardsHeader';
import { DashboardsTable } from './DashboardsTable';
import { DashboardWithFavorite } from './Dashboards.types';
import {
	addTagToDashboard,
	filterDashboards,
	getDashboardTags,
	getFavoriteDashboards,
	removeTagFromDashboard,
	toggleFavorite,
} from './Dashboards.utils';

export const Dashboards = () => {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { data: dashboards = [], isLoading } = useGetDashboards();
	const { data: availableTags = [] } = useTags();
	const deleteDashboardMutation = useDeleteDashboard();
	const { setInitialState, resetDashboard } = useDashboard();

	const [searchTerm, setSearchTerm] = useState('');
	const [selectedTagFilters, setSelectedTagFilters] = useState<number[]>([]);
	const [favorites, setFavorites] = useState<string[]>(() => getFavoriteDashboards());
	const [dashboardTags, setDashboardTags] = useState<Record<string, Tag[]>>(() => getDashboardTags());

	const enrichedDashboards = useMemo<DashboardWithFavorite[]>(() => {
		return dashboards.map((d) => ({
			...d,
			isFavorite: favorites.includes(d.id),
			tags: dashboardTags[d.id] || [],
		}));
	}, [dashboards, favorites, dashboardTags]);

	const filteredDashboards = useMemo(() => {
		let result = filterDashboards(enrichedDashboards, searchTerm);

		if (selectedTagFilters.length > 0) {
			result = result.filter((d) => d.tags?.some((tag) => selectedTagFilters.includes(tag.id)));
		}

		return result;
	}, [enrichedDashboards, searchTerm, selectedTagFilters]);

	const handleTagFilterToggle = useCallback((tagId: number) => {
		setSelectedTagFilters((prev) =>
			prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
		);
	}, []);

	const clearTagFilters = useCallback(() => {
		setSelectedTagFilters([]);
	}, []);

	const handleDashboardClick = useCallback(
		(dashboard: Dashboard) => {
			setInitialState({
				id: dashboard.id,
				name: dashboard.name,
				type: dashboard.type,
				description: dashboard.description || '',
				visibleColumns: dashboard.visibleColumns || [],
				filters: dashboard.filters || {},
				columnOrder: [],
				groupBy: dashboard.groupBy || [],
				query: dashboard.query || '',
			});
			navigate('/alerts');
		},
		[navigate, setInitialState]
	);

	const handleDeleteDashboard = useCallback(
		async (dashboardId: string) => {
			try {
				await deleteDashboardMutation.mutateAsync(dashboardId);
				toast({
					title: 'Dashboard deleted',
					description: 'The dashboard has been successfully deleted.',
				});
			} catch (error) {
				toast({
					title: 'Error',
					description: 'Failed to delete dashboard',
					variant: 'destructive',
				});
			}
		},
		[deleteDashboardMutation, toast]
	);

	const handleToggleFavorite = useCallback((dashboardId: string) => {
		const newFavorites = toggleFavorite(dashboardId);
		setFavorites(newFavorites);
	}, []);

	const handleAddTag = useCallback((dashboardId: string, tag: Tag) => {
		const newTags = addTagToDashboard(dashboardId, tag);
		setDashboardTags({ ...newTags });
	}, []);

	const handleRemoveTag = useCallback((dashboardId: string, tagId: number) => {
		const newTags = removeTagFromDashboard(dashboardId, tagId);
		setDashboardTags({ ...newTags });
	}, []);

	const handleCreateDashboard = useCallback(() => {
		resetDashboard();
		navigate('/alerts');
	}, [navigate, resetDashboard]);

	return (
		<DashboardLayout>
			<div className="flex flex-col h-full p-6">
				<DashboardsHeader onCreateDashboard={handleCreateDashboard} />

				<DashboardsFilter
					searchTerm={searchTerm}
					onSearchChange={setSearchTerm}
					availableTags={availableTags}
					selectedTagIds={selectedTagFilters}
					onTagToggle={handleTagFilterToggle}
					onClearTagFilters={clearTagFilters}
				/>

				<DashboardsTable
					dashboards={filteredDashboards}
					isLoading={isLoading}
					onDashboardClick={handleDashboardClick}
					onDeleteDashboard={handleDeleteDashboard}
					onToggleFavorite={handleToggleFavorite}
					onCreateDashboard={handleCreateDashboard}
					onAddTag={handleAddTag}
					onRemoveTag={handleRemoveTag}
					availableTags={availableTags}
				/>
			</div>
		</DashboardLayout>
	);
};

export default Dashboards;
