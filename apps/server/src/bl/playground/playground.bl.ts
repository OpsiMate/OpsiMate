import { Logger } from '@OpsiMate/shared';
import { PlaygroundRepository } from '../../dal/playgroundRepository.ts';

const logger = new Logger('bl/playground.bl');

export class PlaygroundBL {
	constructor(private readonly playgroundRepo: PlaygroundRepository) {}

	async bookDemo(email?: string, trackingId?: string): Promise<void> {
		try {
			return await this.playgroundRepo.bookDemo(email, trackingId);
		} catch (error) {
			logger.info('Unable to fetch providers');
			throw error;
		}
	}
}
