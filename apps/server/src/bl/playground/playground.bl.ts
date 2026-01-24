import { Logger } from '@OpsiMate/shared';
import { PlaygroundRepository } from '../../dal/playgroundRepository.ts';
import { MailClient, MailType } from '../../dal/external-client/mail-client.ts';

const logger = new Logger('bl/playground.bl');

export class PlaygroundBL {
	constructor(
		private readonly playgroundRepo: PlaygroundRepository,
		private readonly mailClient: MailClient
	) {}

	async bookDemo(email?: string, trackingId?: string): Promise<void> {
		try {
			await this.mailClient.sendMail({
				to: 'opsimate.dev@gmail.com',
				mailType: MailType.PLAYGROUND_DEMO,
				demo_user_email: email,
				demo_user_tracking_id: trackingId,
			});
		} catch (error) {
			logger.error('Couldnt send mail', error);
		}

		try {
			return await this.playgroundRepo.bookDemo(email, trackingId);
		} catch (error) {
			logger.error('Couldnt book a demo', error);
			throw error;
		}
	}
}
