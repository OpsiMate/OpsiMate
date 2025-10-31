import { Request, Response } from 'express';
import PromiseRouter from 'express-promise-router';
import { isEmailEnabled } from '../config/config';

const router = PromiseRouter();

function healthCheck(req: Request, res: Response) {
	res.send('ok');
}

function emailStatusHandler(req: Request, res: Response) {
	const emailEnabled = isEmailEnabled();
	return res.status(200).json({
		success: true,
		data: {
			isEmailEnabled: emailEnabled,
		},
	});
}

router.get('/health', healthCheck);

router.get('/email-status', emailStatusHandler);

router.get('/', (_req: Request, res: Response) => {
	res.json({
		message: 'Welcome to Opsimate server',
		status: 'Server is up and running',
		timestamp: new Date().toISOString(),
	});
});

export default router;
