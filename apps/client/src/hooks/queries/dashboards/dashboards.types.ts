import { DashboardTimeRange, Tag } from '@OpsiMate/shared';

export interface Dashboard {
	id: string;
	name: string;
	type: 'services' | 'alerts';
	description?: string;
	filters: Record<string, string[]>;
	visibleColumns: string[];
	// User-arranged base-column order; absent on dashboards saved before reordering shipped.
	columnOrder?: string[];
	// Persist the "Split by owner" toggle with the dashboard.
	splitByAssignment?: boolean;
	// Persist the "Severity colors" toggle with the dashboard.
	severityColors?: boolean;
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
	columnOrder?: string[];
	splitByAssignment?: boolean;
	severityColors?: boolean;
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
