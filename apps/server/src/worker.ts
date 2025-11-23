import { initializeDb } from './dal/db';
import { createApp } from './app';
import { Logger } from '@OpsiMate/shared';
import { initializePrivateKeysDir } from './dal/sshClient';

const logger = new Logger('worker');

await (async () => {
	logger.info('Initializing worker process...');

	// Initialize database and directories
	const db = initializeDb();
	initializePrivateKeysDir();

	// Create app with jobs enabled (Express app won't be used, just initialization)
    // TODO: Remove the express app and just use the BL
	await createApp(db, { enableJobs: true });

	logger.info('Worker process started successfully - background jobs are running');

	// Keep process alive
	process.on('SIGTERM', () => {
		logger.info('SIGTERM received, shutting down worker gracefully');
		process.exit(0);
	});

	process.on('SIGINT', () => {
		logger.info('SIGINT received, shutting down worker gracefully');
		process.exit(0);
	});
})();
