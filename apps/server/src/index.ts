import { initializeDb } from './dal/db';
import { createApp, AppMode } from './app';
import { getServerConfig } from './config/config';
import { warnIfEncryptionKeyInsecure } from './utils/encryption';
import { Logger } from '@OpsiMate/shared';

const logger = new Logger('server');

await (async () => {
	// Nudge, don't block: a production boot with no ENCRYPTION_KEY encrypts credentials
	// under the public fallback key — warn loudly but keep existing deployments running.
	warnIfEncryptionKeyInsecure();

	const serverConfig = getServerConfig();

	// Allow environment variable to override config file
	const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : serverConfig.port;
	const HOST = process.env.HOST || serverConfig.host;

	const db = initializeDb();
	const app = await createApp(db, AppMode.SERVER);

	if (!app) {
		throw new Error('Failed to create Express application');
	}

	app.listen(PORT, HOST, () => {
		logger.info(`Server running on ${HOST}:${PORT}`);
	});
})();
