import { Request, Response } from 'express';
import PromiseRouter from 'express-promise-router';
import { isEmailEnabled } from '../config/config';
import { Logger } from '@OpsiMate/shared';

const logger = new Logger('api/health');

const router = PromiseRouter();

function healthCheck(req: Request, res: Response) {
	res.send('ok');
}

router.get('/health', healthCheck);

router.get('/email-status', emailStatusHandler);

async function emailStatusHandler(req: Request, res: Response) {
	try {
		const emailEnabled = isEmailEnabled();
		return res.status(200).json({ 
			success: true, 
			emailEnabled,
			message: emailEnabled ? 'Email functionality is enabled' : 'Email functionality is disabled'
		});
	} catch (error) {
		logger.error('Error checking email status:', error);
		return res.status(500).json({ success: false, error: 'Internal server error' });
	}
};


router.get('/', (_req: Request, res: Response) => {
	res.json({
		message: 'Welcome to Opsimate server',
		status: 'Server is up and running',
		timestamp: new Date().toISOString(),
	});
});

export default router;
