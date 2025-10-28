import { initializeDb } from './dal/db.js';
import { createApp } from './app.js';
import { getServerConfig } from './config/config.js';
import { Logger } from '@opsimate/shared';
import { initializePrivateKeysDir } from './dal/sshClient.js';

const logger = new Logger('server');

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    const serverConfig = getServerConfig();
    
    // Allow environment variable to override config file
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : serverConfig.port;
    const HOST = process.env.HOST || serverConfig.host;
    
    const db = initializeDb();
    initializePrivateKeysDir();
    const app = await createApp(db, {enableJobs: true});

    app.listen(PORT, HOST, () => {
        logger.info(`Server running on ${HOST}:${PORT}`);
    });
})();
