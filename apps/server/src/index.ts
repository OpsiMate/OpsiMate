import { initializeDb } from './dal/db';
import { createApp, AppMode } from './app';
import { getServerConfig } from './config/config';
import { Logger } from '@OpsiMate/shared';
import { moveLegacyCredentials, prepareInstanceSecrets } from './bootSecrets';

const logger = new Logger('server');

await (async () => {
	const serverConfig = getServerConfig();

	// Allow environment variable to override config file
	const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : serverConfig.port;
	const HOST = process.env.HOST || serverConfig.host;

	// The session and encryption keys: from the environment, or generated once next to the
	// database. Settled before anything signs a token or decrypts a credential.
	prepareInstanceSecrets();

	const db = initializeDb();
	const app = await createApp(db, AppMode.SERVER);

	if (!app) {
		throw new Error('Failed to create Express application');
	}

	app.listen(PORT, HOST, () => {
		logger.info(`Server running on ${HOST}:${PORT}`);
		// In the background once the port is open, one credential at a time, so it never
		// holds up a request or a health check. Until a value has moved it is read through
		// the old-key fallback in decryptPassword.
		void moveLegacyCredentials(db);
	});
})();
