import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';

export interface DashboardWithFavorite extends Dashboard {
	isFavorite: boolean;
}

export interface DashboardsTableProps {
	dashboards: DashboardWithFavorite[];
	isLoading: boolean;
	onDashboardClick: (dashboard: Dashboard) => void;
	onDeleteDashboard: (dashboardId: string) => void;
	onToggleFavorite: (dashboardId: string) => void;
	onCreateDashboard: () => void;
}

export interface DashboardRowProps {
	dashboard: DashboardWithFavorite;
	onClick: () => void;
	onDelete: () => void;
	onToggleFavorite: () => void;
}

export type DashboardSortField = 'name' | 'createdAt';
export type SortDirection = 'asc' | 'desc';
