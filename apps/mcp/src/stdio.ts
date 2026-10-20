import { serveStdio, StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { McpConfig } from './config';
import { createMcpServer } from './mcp/server';
import { CallerCredentials } from './opsimate/auth';
import { OpsiMateClient } from './opsimate/client';

// stdio mode: the MCP client (Claude Desktop, an IDE) starts this process itself and
// talks over stdin/stdout, so there is one caller — whoever configured the credential in
// the process environment. One McpServer serves the connection.
export const serveOverStdio = (config: McpConfig, credentials: CallerCredentials): StdioServerHandle => {
	// stdout is the protocol channel: anything else written there corrupts it. The
	// shared Logger prints with console.log/warn; send all of it to stderr.
	for (const level of ['log', 'info', 'debug', 'warn'] as const) {
		// eslint-disable-next-line no-console
		console[level] = (...args: unknown[]) => console.error(...args);
	}
	const client = new OpsiMateClient(config.opsimateUrl, credentials, {
		timeoutMs: config.opsimateTimeoutMs,
	});
	return serveStdio(() => createMcpServer({ client, version: config.version }));
};
