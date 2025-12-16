import { AuditActionType, AuditResourceType, Dashboard, Tag, User } from '@OpsiMate/shared';
import { DashboardRepository } from '../../dal/dashboardRepository.ts';
import { AuditBL } from '../audit/audit.bl';
import { TagBL } from '../tags/tag.bl';

export class DashboardBL {
	constructor(
		private dashboardRepository: DashboardRepository,
		private auditBL: AuditBL,
		private tagBL: TagBL
	) {}

	async getAllDashboards(): Promise<Dashboard[]> {
		return await this.dashboardRepository.getAllDashboards();
	}

	async getDashboardById(id: string): Promise<Dashboard | null> {
		return await this.dashboardRepository.getDashboardById(id);
	}

	async createDashboard(dashboard: Omit<Dashboard, 'createdAt' | 'id'>, user: User): Promise<number> {
		const dashboardId = await this.dashboardRepository.createDashboard(dashboard);

		await this.auditBL.logAction({
			actionType: AuditActionType.CREATE,
			resourceType: AuditResourceType.DASHBOARD,
			resourceId: dashboardId.toString(),
			userId: user.id,
			userName: user.fullName,
			resourceName: dashboard.name,
		});

		return dashboardId;
	}

	async deleteDashboard(id: string): Promise<boolean> {
		const existingDashboard = await this.dashboardRepository.getDashboardById(id);
		if (!existingDashboard) {
			return false;
		}

		return await this.dashboardRepository.deleteDashboard(id);
	}

	async updateDashboard(dashboardId: string, dashboard: Omit<Dashboard, 'createdAt' | 'id'>, user: User) {
		const currentDashboard = await this.dashboardRepository.getDashboardById(dashboardId);
		if (!currentDashboard) {
			throw new Error(`Dashboard with ID ${dashboardId} not found`);
		}
		const updated = await this.dashboardRepository.updateDashboard(dashboardId, dashboard);
		if (!updated) {
			throw new Error(`Failed to update dashboard with ID ${dashboardId}`);
		}

		await this.auditBL.logAction({
			actionType: AuditActionType.UPDATE,
			resourceType: AuditResourceType.DASHBOARD,
			resourceId: dashboardId.toString(),
			userId: user.id,
			userName: user.fullName,
			resourceName: dashboard.name,
		});
	}

	async getDashboardTags(dashboardId: number): Promise<Tag[]> {
		return await this.tagBL.getDashboardTags(dashboardId);
	}

	async getAllDashboardTags(): Promise<{ dashboardId: number; tags: Tag[] }[]> {
		return await this.tagBL.getAllDashboardTags();
	}

	async addTagToDashboard(dashboardId: number, tagId: number): Promise<void> {
		const tag = await this.tagBL.getTagById(tagId);
		if (!tag) {
			throw new Error(`Tag with ID ${tagId} not found`);
		}
		return await this.tagBL.addTagToDashboard(dashboardId, tagId);
	}

	async removeTagFromDashboard(dashboardId: number, tagId: number): Promise<void> {
		const tag = await this.tagBL.getTagById(tagId);
		if (!tag) {
			throw new Error(`Tag with ID ${tagId} not found`);
		}
		return await this.tagBL.removeTagFromDashboard(dashboardId, tagId);
	}
}
