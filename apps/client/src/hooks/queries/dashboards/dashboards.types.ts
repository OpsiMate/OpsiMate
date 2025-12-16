export interface Dashboard {
	id: string;
	name: string;
	type: 'services' | 'alerts';
	description?: string;
	filters: Record<string, string[]>;
	visibleColumns: string[];
	query: string;
	groupBy: string[];
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
}

export interface UpdateDashboardInput extends CreateDashboardInput {
	id: string;
}

import { Tag } from '@OpsiMate/shared';

export interface DashboardTagsResponse {
	dashboardId: number;
	tags: Tag[];
}
