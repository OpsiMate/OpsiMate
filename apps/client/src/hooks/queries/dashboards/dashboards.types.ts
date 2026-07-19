import { DashboardTimeRange, Tag } from '@OpsiMate/shared';

export interface Dashboard {
	id: string;
	name: string;
	type: 'services' | 'alerts';
	description?: string;
	filters: Record<string, string[]>;
	visibleColumns: string[];
	query: string;
	groupBy: string[];
	timeRange?: DashboardTimeRange;
	createdAt?: string;
}

export interface CreateDashboardInput {
	name: string;
	type: 'services' | 'alerts';
	description?: string;
	filters: Record<string, string[]>;
	visibleColumns: string[];
	query: string;
	groupBy: string[];
	timeRange?: DashboardTimeRange;
}

export interface UpdateDashboardInput extends CreateDashboardInput {
	id: string;
}

export interface DashboardTagsResponse {
	dashboardId: number;
	tags: Tag[];
}
