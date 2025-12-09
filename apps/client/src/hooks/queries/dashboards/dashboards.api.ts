import { apiRequest } from '@/lib/api';
import { CreateDashboardInput, Dashboard } from './dashboards.types';

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
};
