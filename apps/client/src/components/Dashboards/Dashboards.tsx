import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDashboard } from '@/context/DashboardContext';
import { useDeleteDashboard, useGetDashboards } from '@/hooks/queries/dashboards';
import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';
import { useTags } from '@/hooks/queries/tags';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tag } from '@OpsiMate/shared';
import { Check, LayoutDashboard, Plus, Search, Tags, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardsTable } from './DashboardsTable';
import { DashboardWithFavorite } from './Dashboards.types';
import {
	addTagToDashboard,
	filterDashboards,
	getContrastColor,
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
	const [isSearchFocused, setIsSearchFocused] = useState(false);
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

	const selectedTags = useMemo(() => {
		return availableTags.filter((tag) => selectedTagFilters.includes(tag.id));
	}, [availableTags, selectedTagFilters]);

	const handleTagFilterToggle = (tagId: number) => {
		setSelectedTagFilters((prev) =>
			prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
		);
	};

	const clearTagFilters = () => {
		setSelectedTagFilters([]);
	};

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
					<div className="flex items-center gap-2 border rounded-md p-1 bg-background">
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className={cn(
										'gap-2 h-7',
										selectedTagFilters.length > 0 && 'text-primary'
									)}
								>
									<Tags className="h-4 w-4" />
									Tags
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-[200px] p-2" align="start">
								{availableTags.length === 0 ? (
									<div className="text-sm text-muted-foreground text-center py-2">No tags available</div>
								) : (
									<>
										<div className="space-y-1">
											{availableTags.map((tag) => (
												<button
													key={tag.id}
													className={cn(
														'w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left',
														selectedTagFilters.includes(tag.id)
															? 'bg-primary/10'
															: 'hover:bg-muted'
													)}
													onClick={() => handleTagFilterToggle(tag.id)}
												>
													<div
														className="w-3 h-3 rounded-full flex-shrink-0"
														style={{ backgroundColor: tag.color }}
													/>
													<span className="text-sm flex-1 truncate">{tag.name}</span>
													{selectedTagFilters.includes(tag.id) && (
														<Check className="h-4 w-4 text-primary" />
													)}
												</button>
											))}
										</div>
										{selectedTagFilters.length > 0 && (
											<>
												<div className="border-t my-2" />
												<button
													className="w-full text-sm text-muted-foreground hover:text-foreground text-center py-1"
													onClick={clearTagFilters}
												>
													Clear filters
												</button>
											</>
										)}
									</>
								)}
							</PopoverContent>
						</Popover>

						{selectedTags.length > 0 && (
							<TooltipProvider delayDuration={200}>
								<div className="flex items-center gap-1 flex-wrap max-w-[280px]">
									{selectedTags.map((tag) => {
										const firstWord = tag.name.split(' ')[0];
										const isTruncated = firstWord.length > 6 || tag.name !== firstWord;
										const displayText = firstWord.length > 6 ? firstWord.slice(0, 6) : firstWord;

										return (
											<Tooltip key={tag.id}>
												<TooltipTrigger asChild>
													<button
														className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors hover:opacity-80"
														style={{
															backgroundColor: tag.color,
															color: getContrastColor(tag.color),
														}}
														onClick={() => handleTagFilterToggle(tag.id)}
													>
														<span>{displayText}{isTruncated && '...'}</span>
														<X className="h-2.5 w-2.5 flex-shrink-0" />
													</button>
												</TooltipTrigger>
												<TooltipContent side="top" className="text-xs">
													{tag.name}
												</TooltipContent>
											</Tooltip>
										);
									})}
								</div>
							</TooltipProvider>
						)}
					</div>

					<div
						className={cn(
							'relative transition-all duration-300 ease-in-out',
							isSearchFocused || searchTerm ? 'w-96' : 'w-64'
						)}
					>
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search dashboards..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							onFocus={() => setIsSearchFocused(true)}
							onBlur={() => setIsSearchFocused(false)}
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
