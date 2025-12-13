import { Tag } from '@OpsiMate/shared';
import { TagRepository } from '../../dal/tagRepository';

export class TagBL {
	constructor(private tagRepository: TagRepository) {}

	async getAllTags(): Promise<Tag[]> {
		return await this.tagRepository.getAllTags();
	}

	async getTagById(id: number): Promise<Tag | undefined> {
		return await this.tagRepository.getTagById(id);
	}

	async createTag(data: Omit<Tag, 'id' | 'createdAt'>): Promise<{ lastID: number }> {
		return await this.tagRepository.createTag(data);
	}

	async updateTag(id: number, data: Partial<Omit<Tag, 'id' | 'createdAt'>>): Promise<void> {
		return await this.tagRepository.updateTag(id, data);
	}

	async deleteTag(id: number): Promise<void> {
		return await this.tagRepository.deleteTag(id);
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

	async getServiceTags(serviceId: number): Promise<Tag[]> {
		return await this.tagRepository.getServiceTags(serviceId);
	}

	async addTagToService(serviceId: number, tagId: number): Promise<void> {
		return await this.tagRepository.addTagToService(serviceId, tagId);
	}

	async removeTagFromService(serviceId: number, tagId: number): Promise<void> {
		return await this.tagRepository.removeTagFromService(serviceId, tagId);
	}

	async countServicesUsingTag(tagId: number): Promise<number> {
		return await this.tagRepository.countServicesUsingTag(tagId);
	}

	async deleteAllServiceTags(serviceId: number): Promise<number> {
		return await this.tagRepository.deleteAllServiceTags(serviceId);
	}

	async findServiceIdsByTagName(tagName: string): Promise<number[]> {
		return await this.tagRepository.findServiceIdsByTagName(tagName);
	}

	async deleteAllDashboardTags(dashboardId: number): Promise<number> {
		return await this.tagRepository.deleteAllDashboardTags(dashboardId);
	}
}
