import { Logger } from '@OpsiMate/shared';
import { CustomActionRepository } from '../../dal/customActionRepository';
import { CustomAction } from '@OpsiMate/custom-actions';

const logger: Logger = new Logger('bl/custom-actions');

export class CustomActionBL {
	constructor(private repo: CustomActionRepository) {}

	async create(data: CustomAction): Promise<number> {
		const res = await this.repo.create(data);
		logger.info(`Created custom action id=${res.lastID}`);
		return res.lastID;
	}

	list(): Promise<CustomAction[]> {
		return this.repo.list();
	}

	getById(id: number): Promise<CustomAction | undefined> {
		return this.repo.getById(id);
	}

	async update(id: number, data: CustomAction): Promise<void> {
		await this.repo.update(id, data);
		logger.info(`Updated custom action id=${id}`);
	}

	async delete(id: number): Promise<void> {
		await this.repo.delete(id);
		logger.info(`Deleted custom action id=${id}`);
	}
}


