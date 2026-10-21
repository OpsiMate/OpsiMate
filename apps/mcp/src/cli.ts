#!/usr/bin/env node
import { Logger } from '@OpsiMate/shared';
import { readConfig } from './config';
import { createHttpApp } from './http/app';
import { credentialsFromEnv } from './opsimate/auth';
import { serveOverStdio } from './stdio';

// opsimate-mcp                      Streamable HTTP server (the container): listens on
//                                   MCP_PORT (3100) at MCP_PATH (/mcp), forwards each
//                                   caller's credentials to OPSIMATE_URL.
// opsimate-mcp --stdio              stdio server for a client that starts it locally,
//                                   with OPSIMATE_API_TOKEN or OPSIMATE_TOKEN.
// --url <OpsiMate URL>              overrides OPSIMATE_URL in either mode.

const logger = new Logger('mcp/cli');

const main = (): void => {
	const args = process.argv.slice(2);
	const urlIndex = args.indexOf('--url');
	if (urlIndex >= 0) {
		const url = args[urlIndex + 1];
		if (!url || url.startsWith('--')) {
			process.stderr.write('opsimate-mcp: --url needs a value, the OpsiMate URL (e.g. http://localhost:3001).\n');
			process.exit(2);
		}
		process.env.OPSIMATE_URL = url;
	}
	const config = readConfig();

	if (args.includes('--stdio')) {
		const credentials = credentialsFromEnv(process.env);
		if (!credentials) {
			process.stderr.write(
				'opsimate-mcp --stdio needs OPSIMATE_API_TOKEN (the instance API token) or OPSIMATE_TOKEN (a login token) in its environment.\n'
			);
			process.exit(2);
		}
		const handle = serveOverStdio(config, credentials);
		const stop = () => void handle.close().finally(() => process.exit(0));
		process.on('SIGINT', stop);
		process.on('SIGTERM', stop);
		return;
	}

	const app = createHttpApp(config);
	const server = app.listen(config.port, config.host, () => {
		logger.info(
			`OpsiMate MCP ${config.version} listening on http://${config.host}:${config.port}${config.path} -> ${config.opsimateUrl}`
		);
	});
	const stop = () => server.close(() => process.exit(0));
	process.on('SIGINT', stop);
	process.on('SIGTERM', stop);
};

main();
