import { initializeDb } from './dal/db';
import { createApp } from './app';
import { getServerConfig } from './config/config';
import { Logger } from '@OpsiMate/shared';
import { initializePrivateKeysDir } from './dal/sshClient';

const logger = new Logger('server');

await (async () => {
	const serverConfig = getServerConfig();

	// Allow environment variable to override config file
	const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : serverConfig.port;
	const HOST = process.env.HOST || serverConfig.host;

	const db = initializeDb();
	initializePrivateKeysDir();
	const app = await createApp(db, { enableJobs: true });

	app.listen(PORT, HOST, () => {
		logger.info(`Server running on ${HOST}:${PORT}`);
	});
})();
