import { serveStdio, StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { inspect } from 'node:util';
import { McpConfig } from './config';
import { createMcpServer } from './mcp/server';
import { CallerCredentials } from './opsimate/auth';
import { OpsiMateClient } from './opsimate/client';

// stdout is the protocol channel: anything else written there corrupts it. The shared
// Logger prints with console.log/warn and dumps error details with console.dir, all of
// which land on stdout by default; send every one of them to stderr.
export const redirectConsoleToStderr = (): void => {
	/* eslint-disable no-console */
	for (const level of ['log', 'info', 'debug', 'warn'] as const) {
		console[level] = (...args: unknown[]) => console.error(...args);
	}
	console.dir = (value: unknown, options?: object) => console.error(inspect(value, options ?? {}));
	console.table = (value: unknown) => console.error(inspect(value));
	/* eslint-enable no-console */
};

// stdio mode: the MCP client (Claude Desktop, an IDE) starts this process itself and
// talks over stdin/stdout, so there is one caller — whoever configured the credential in
// the process environment. One McpServer serves the connection.
export const serveOverStdio = (config: McpConfig, credentials: CallerCredentials): StdioServerHandle => {
	redirectConsoleToStderr();
	const client = new OpsiMateClient(config.opsimateUrl, credentials, {
		timeoutMs: config.opsimateTimeoutMs,
	});
	return serveStdio(() => createMcpServer({ client, version: config.version }));
};
