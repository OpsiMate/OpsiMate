import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';
import { Tag } from '@OpsiMate/shared';

export interface DashboardWithFavorite extends Dashboard {
	isFavorite: boolean;
	tags?: Tag[];
}

export interface DashboardsTableProps {
	dashboards: DashboardWithFavorite[];
	isLoading: boolean;
	onDashboardClick: (dashboard: Dashboard) => void;
	onDeleteDashboard: (dashboardId: string) => void;
	onToggleFavorite: (dashboardId: string) => void;
	onCreateDashboard: () => void;
	onAddTag?: (dashboardId: string, tag: Tag) => void;
	onRemoveTag?: (dashboardId: string, tagId: number) => void;
	availableTags?: Tag[];
}

export interface DashboardRowProps {
	dashboard: DashboardWithFavorite;
	onClick: () => void;
	onDelete: () => void;
	onToggleFavorite: () => void;
	onAddTag?: (tag: Tag) => void;
	onRemoveTag?: (tagId: number) => void;
	availableTags?: Tag[];
}

export type DashboardSortField = 'name' | 'createdAt';
export type SortDirection = 'asc' | 'desc';
