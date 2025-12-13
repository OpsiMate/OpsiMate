import { DashboardLayout } from '@/components/DashboardLayout';
import { useDashboard } from '@/context/DashboardContext';
import {
	useAddTagToDashboard,
	useDeleteDashboard,
	useGetAllDashboardTags,
	useGetDashboards,
	useRemoveTagFromDashboard,
} from '@/hooks/queries/dashboards';
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
import { filterDashboards, getFavoriteDashboards, toggleFavorite } from './Dashboards.utils';

export const Dashboards = () => {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { data: dashboards = [], isLoading } = useGetDashboards();
	const { data: availableTags = [] } = useTags();
	const { data: dashboardTagsData = [] } = useGetAllDashboardTags();
	const deleteDashboardMutation = useDeleteDashboard();
	const addTagMutation = useAddTagToDashboard();
	const removeTagMutation = useRemoveTagFromDashboard();
	const { setInitialState, resetDashboard } = useDashboard();

	const [searchTerm, setSearchTerm] = useState('');
	const [selectedTagFilters, setSelectedTagFilters] = useState<number[]>([]);
	const [favorites, setFavorites] = useState<string[]>(() => getFavoriteDashboards());

	const dashboardTagsMap = useMemo(() => {
		const map: Record<string, Tag[]> = {};
		for (const item of dashboardTagsData) {
			map[String(item.dashboardId)] = item.tags;
		}
		return map;
	}, [dashboardTagsData]);

	const usedDashboardTags = useMemo(() => {
		const tagMap = new Map<number, Tag>();
		for (const item of dashboardTagsData) {
			for (const tag of item.tags) {
				if (!tagMap.has(tag.id)) {
					tagMap.set(tag.id, tag);
				}
			}
		}
		return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
	}, [dashboardTagsData]);

	const enrichedDashboards = useMemo<DashboardWithFavorite[]>(() => {
		return dashboards.map((d) => ({
			...d,
			isFavorite: favorites.includes(d.id),
			tags: dashboardTagsMap[d.id] || [],
		}));
	}, [dashboards, favorites, dashboardTagsMap]);

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
				const errorMessage = error instanceof Error ? error.message : 'Failed to delete dashboard';
				toast({
					title: 'Error',
					description: errorMessage,
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

	const handleAddTag = useCallback(
		async (dashboardId: string, tag: Tag) => {
			try {
				await addTagMutation.mutateAsync({ dashboardId, tagId: tag.id });
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to add tag';
				toast({
					title: 'Error',
					description: errorMessage,
					variant: 'destructive',
				});
			}
		},
		[addTagMutation, toast]
	);

	const handleRemoveTag = useCallback(
		async (dashboardId: string, tagId: number) => {
			try {
				await removeTagMutation.mutateAsync({ dashboardId, tagId });
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to remove tag';
				toast({
					title: 'Error',
					description: errorMessage,
					variant: 'destructive',
				});
			}
		},
		[removeTagMutation, toast]
	);

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
					availableTags={usedDashboardTags}
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
