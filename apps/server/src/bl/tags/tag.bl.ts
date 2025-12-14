import { Tag } from '@OpsiMate/shared';
import { TagRepository } from '../../dal/tagRepository';

export class TagBL {
	constructor(private tagRepository: TagRepository) {}

	async getTagById(id: number): Promise<Tag | undefined> {
		return await this.tagRepository.getTagById(id);
	}

	async getDashboardTags(dashboardId: number): Promise<Tag[]> {
		return await this.tagRepository.getDashboardTags(dashboardId);
	}

	async getAllDashboardTags(): Promise<{ dashboardId: number; tags: Tag[] }[]> {
		return await this.tagRepository.getAllDashboardTags();
	}

	async addTagToDashboard(dashboardId: number, tagId: number): Promise<void> {
		return await this.tagRepository.addTagToDashboard(dashboardId, tagId);
	}

	async removeTagFromDashboard(dashboardId: number, tagId: number): Promise<void> {
		return await this.tagRepository.removeTagFromDashboard(dashboardId, tagId);
	}
}
