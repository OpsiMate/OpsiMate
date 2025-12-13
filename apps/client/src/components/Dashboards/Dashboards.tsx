import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDashboard } from '@/context/DashboardContext';
import { useDeleteDashboard, useGetDashboards } from '@/hooks/queries/dashboards';
import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';
import { useTags } from '@/hooks/queries/tags';
import { useToast } from '@/hooks/use-toast';
import { Tag } from '@OpsiMate/shared';
import { LayoutDashboard, Plus, Search, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
		return filterDashboards(enrichedDashboards, searchTerm);
	}, [enrichedDashboards, searchTerm]);

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
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center gap-3">
						<LayoutDashboard className="h-7 w-7 text-primary" />
						<h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboards</h1>
					</div>
					<Button onClick={handleCreateDashboard} className="gap-2">
						<Plus className="h-4 w-4" />
						New Dashboard
					</Button>
				</div>

				<div className="flex items-center gap-4 mb-4">
					<div className="relative flex-1 max-w-md">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search dashboards by name, description, or tag..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10 pr-10"
						/>
						{searchTerm && (
							<Button
								variant="ghost"
								size="icon"
								className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
								onClick={() => setSearchTerm('')}
							>
								<X className="h-4 w-4" />
							</Button>
						)}
					</div>
					<div className="text-sm text-muted-foreground">
						{filteredDashboards.length} dashboard{filteredDashboards.length !== 1 ? 's' : ''}
						{searchTerm && ` matching "${searchTerm}"`}
					</div>
				</div>

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
