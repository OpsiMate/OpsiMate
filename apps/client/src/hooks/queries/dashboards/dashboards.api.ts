import { apiRequest } from '@/lib/api';
import { Tag } from '@OpsiMate/shared';
import { CreateDashboardInput, Dashboard, DashboardTagsResponse } from './dashboards.types';

export const dashboardsApi = {
	getAllDashboards: () => {
		return apiRequest<Dashboard[]>('/dashboards');
	},
	createDashboard: (data: CreateDashboardInput) => {
		return apiRequest<{ id: string }>('/dashboards', 'POST', data);
	},
	updateDashboard: (id: string, data: CreateDashboardInput) => {
		return apiRequest<Dashboard>(`/dashboards/${id}`, 'PUT', data);
	},
	deleteDashboard: (id: string) => {
		return apiRequest<void>(`/dashboards/${id}`, 'DELETE');
	},
	getAllDashboardTags: () => {
		return apiRequest<DashboardTagsResponse[]>('/dashboards/tags');
	},
	getDashboardTags: (dashboardId: string) => {
		return apiRequest<Tag[]>(`/dashboards/${dashboardId}/tags`);
	},
	addTagToDashboard: (dashboardId: string, tagId: number) => {
		return apiRequest<void>(`/dashboards/${dashboardId}/tags`, 'POST', { tagId });
	},
	removeTagFromDashboard: (dashboardId: string, tagId: number) => {
		return apiRequest<void>(`/dashboards/${dashboardId}/tags/${tagId}`, 'DELETE');
	},
};
