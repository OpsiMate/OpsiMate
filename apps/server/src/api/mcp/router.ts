import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { Request, Response, Router } from 'express';
import { Logger } from '@OpsiMate/shared';
import { authenticateReadOnly } from '../../middleware/auth';
import { createRateLimit } from '../../middleware/rateLimit';
import { McpDeps } from './deps';
import { createMcpServer } from './server';

// The MCP endpoint: Streamable HTTP at POST /api/mcp, for assistants (Claude Code, Cursor,
// Claude Desktop...) that read alerts and dashboards through tools. Stateless — the SDK
// handler builds a fresh server per request — so it needs no session store and works
// behind any load balancer. Every tool is read-only, so the auth guard is the read-only
// one: the instance API token, or any user's JWT (Viewers included). Set
// MCP_ENABLED=false to turn it off.
//
// Rate limited per caller (user, or the API token): an assistant in a loop can issue
// requests far faster than a person, and get_alert_analytics is real CPU per call.
// MCP_RATE_LIMIT_PER_MINUTE sets the limit (default 240; 0 = none).

const logger = new Logger('api/mcp/router');

export const MCP_PATH = '/api/mcp';

export const mcpEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
	(env.MCP_ENABLED ?? '').trim().toLowerCase() !== 'false';

export const DEFAULT_MCP_RATE_LIMIT_PER_MINUTE = 240;

// Unset or unparseable = the default; a non-negative integer is taken as is (0 = no limit).
export const mcpRateLimitPerMinute = (env: NodeJS.ProcessEnv = process.env): number => {
	const raw = (env.MCP_RATE_LIMIT_PER_MINUTE ?? '').trim();
	if (raw === '') return DEFAULT_MCP_RATE_LIMIT_PER_MINUTE;
	const parsed = Number(raw);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_MCP_RATE_LIMIT_PER_MINUTE;
};

export const createMcpRouter = (deps: McpDeps): Router => {
	const handler = createMcpHandler(() => createMcpServer(deps), {
		onerror: (error) => logger.error('MCP request failed', error),
	});
	const serveMcp = toNodeHandler(handler, {
		onerror: (error) => logger.error('MCP adapter failed', error),
	});

	// express.json() has already consumed a POST body, so the parsed one is handed over;
	// GET/DELETE carry none. The adapter writes the whole response itself (including SSE
	// streams), so Express's `next` is never involved — and must not be passed as the
	// third argument, which is the body slot.
	const serve = (req: Request, res: Response): void => {
		void serveMcp(req, res, req.method === 'POST' ? req.body : undefined);
	};

	// Explicit methods (not router.all) so the route audit in apiDocs.test.ts sees exactly
	// what is served. GET and DELETE are the protocol's session operations; stateless
	// serving answers them with 405, which is the correct signal to a client.
	// After auth, so the bucket is the caller's (and a 401 never counts).
	const rateLimit = createRateLimit({ maxPerWindow: mcpRateLimitPerMinute(), windowMs: 60_000 });
	const router = Router();
	router.post(MCP_PATH, authenticateReadOnly, rateLimit, serve);
	router.get(MCP_PATH, authenticateReadOnly, rateLimit, serve);
	router.delete(MCP_PATH, authenticateReadOnly, rateLimit, serve);
	return router;
};
