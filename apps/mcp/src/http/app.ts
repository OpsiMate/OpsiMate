import { AsyncLocalStorage } from 'node:async_hooks';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { Logger } from '@OpsiMate/shared';
import express, { Express, NextFunction, Request, Response } from 'express';
import { McpConfig } from '../config';
import { createMcpServer } from '../mcp/server';
import { CallerCredentials, callerKey, credentialsFromHeaders } from '../opsimate/auth';
import { OpsiMateClient } from '../opsimate/client';
import { createRateLimit } from './rateLimit';

const logger = new Logger('mcp/http');

export interface HttpAppOptions {
	// Test seam: the fetch OpsiMate is called with.
	fetch?: typeof fetch;
}

interface RequestScope {
	credentials: CallerCredentials;
	key: string;
}

// Streamable HTTP, stateless: every request carries the caller's credentials, which are
// handed to a fresh McpServer whose OpsiMate client forwards them. The request's
// credentials reach the server factory through AsyncLocalStorage, so the SDK handler
// is built once and nothing is held between requests. GET and DELETE (the protocol's
// session operations) are served by the SDK's stateless fallback, which answers 405.
export const createHttpApp = (config: McpConfig, options: HttpAppOptions = {}): Express => {
	const scope = new AsyncLocalStorage<RequestScope>();
	const handler = createMcpHandler(
		() => {
			const current = scope.getStore();
			if (!current) throw new Error('MCP request without a caller scope');
			const client = new OpsiMateClient(config.opsimateUrl, current.credentials, {
				fetch: options.fetch,
				timeoutMs: config.opsimateTimeoutMs,
			});
			return createMcpServer({ client, version: config.version });
		},
		{ onerror: (error) => logger.error('MCP request failed', error) }
	);
	const serveMcp = toNodeHandler(handler, {
		onerror: (error) => logger.error('MCP adapter failed', error),
	});

	// Who is calling, before the body is parsed: an anonymous or throttled caller must not
	// cost a 1 MB JSON parse. Set on the request for the limiter and the log line; refused
	// outright when absent (OpsiMate would refuse it too).
	const requireCredentials = (req: Request, res: Response, next: NextFunction): void => {
		const credentials = credentialsFromHeaders(req.headers);
		if (!credentials) {
			res.status(401).json({
				success: false,
				error: 'Missing credentials: send x-api-token or Authorization: Bearer <token>.',
			});
			return;
		}
		scopes.set(req, { credentials, key: callerKey(credentials) });
		next();
	};
	const scopes = new WeakMap<Request, RequestScope>();
	const rateLimit = createRateLimit({
		maxPerWindow: config.rateLimitPerMinute,
		windowMs: 60_000,
		keyOf: (req) => scopes.get(req)?.key ?? null,
	});

	const serve = (req: Request, res: Response): void => {
		const current = scopes.get(req);
		if (!current) {
			res.status(500).json({ success: false, error: 'Internal error: no caller scope' });
			return;
		}
		const started = Date.now();
		const body = req.method === 'POST' ? (req.body as unknown) : undefined;
		res.on('finish', () => logCall(current.key, body, res.statusCode, Date.now() - started));
		// express.json() has consumed a POST body, so the parsed one is handed over. The
		// adapter writes the whole response itself (SSE included).
		void scope.run(current, () => serveMcp(req, res, body));
	};

	const app = express();
	app.disable('x-powered-by');
	app.get('/health', (_req, res) => {
		res.json({
			status: 'ok',
			version: config.version,
			opsimateUrl: config.opsimateUrl,
			path: config.path,
		});
	});
	app.post(config.path, requireCredentials, rateLimit, express.json({ limit: '1mb' }), serve);
	app.get(config.path, requireCredentials, rateLimit, serve);
	app.delete(config.path, requireCredentials, rateLimit, serve);
	return app;
};

interface JsonRpcLike {
	method?: unknown;
	params?: { name?: unknown };
}

// One line per request: who (a hash of the credential, never the credential), what
// (the JSON-RPC method, and the tool for tools/call), how it went.
const logCall = (key: string, body: unknown, status: number, ms: number): void => {
	const message = (body ?? {}) as JsonRpcLike;
	const method = typeof message.method === 'string' ? message.method : '-';
	const tool = method === 'tools/call' && typeof message.params?.name === 'string' ? ` ${message.params.name}` : '';
	logger.info(`caller=${key} ${method}${tool} -> ${status} (${ms}ms)`);
};
