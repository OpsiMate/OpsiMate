import { Logger } from '@OpsiMate/shared';
import { Request, Response } from 'express';

const logger = new Logger('api/v1/playground/controller');

export class PlaygroundController {
	bookDemoHandler = (req: Request, res: Response) => {
		try {
			const { email, trackingId } = req.body as { email?: string; trackingId?: string };

			if (email && typeof email !== 'string') {
				return res.status(400).json({ success: false, error: 'Email must be a string' });
			}

			if (email) {
				logger.info(`Demo booked - email: ${email}, trackingId: ${trackingId || 'N/A'}`);
			} else if (trackingId) {
				logger.info(`Demo interest tracked - trackingId: ${trackingId}`);
			}

			return res.json({ success: true });
		} catch (error) {
			logger.error('Error booking demo:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
