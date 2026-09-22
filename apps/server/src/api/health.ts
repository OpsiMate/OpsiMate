import { AppVersionInfo } from '@OpsiMate/shared';
import { Request, Response, Router } from 'express';
import { isEmailEnabled } from '../config/config';

const router = Router();

function healthCheck(req: Request, res: Response) {
	res.send('ok');
}

// Baked into the image by the release workflow (see Dockerfile.server); absent in
// local dev, where the answer "dev" is the honest one. Unauthenticated on purpose:
// it leaks nothing an image tag doesn't, and support threads start with "what
// version are you on?" before anyone has logged in.
export const getAppVersionInfo = (env: NodeJS.ProcessEnv = process.env): AppVersionInfo => ({
	version: env.APP_VERSION?.trim() || 'dev',
	commit: env.APP_COMMIT?.trim() || null,
	buildDate: env.APP_BUILD_DATE?.trim() || null,
});

function versionHandler(_req: Request, res: Response) {
	return res.status(200).json({ success: true, data: getAppVersionInfo() });
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

router.get('/version', versionHandler);

router.get('/email-status', emailStatusHandler);

router.get('/', (_req: Request, res: Response) => {
	res.json({
		message: 'Welcome to Opsimate server',
		status: 'Server is up and running',
		timestamp: new Date().toISOString(),
	});
});

export default router;
