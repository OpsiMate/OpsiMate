import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { Request, Response, Router } from 'express';
import { Logger, MCP_PATH } from '@OpsiMate/shared';
import { authenticateReadOnly } from '../../middleware/auth';
import { McpDeps } from './deps';
import { createMcpServer } from './server';

// The MCP endpoint: Streamable HTTP at POST /api/mcp, for assistants (Claude Code, Cursor,
// Claude Desktop...) that read alerts and dashboards through tools. Stateless — the SDK
// handler builds a fresh server per request — so it needs no session store and works
// behind any load balancer. Every tool is read-only, so the auth guard is the read-only
// one: the instance API token, or any user's JWT (Viewers included). Set
// MCP_ENABLED=false to turn it off.

const logger = new Logger('api/mcp/router');

// Re-exported for app.ts (the compression filter) — the value lives in shared, next to
// the tool list, so the Settings guide prints the same path.
export { MCP_PATH };

export const mcpEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
	(env.MCP_ENABLED ?? '').trim().toLowerCase() !== 'false';

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
	const router = Router();
	router.post(MCP_PATH, authenticateReadOnly, serve);
	router.get(MCP_PATH, authenticateReadOnly, serve);
	router.delete(MCP_PATH, authenticateReadOnly, serve);
	return router;
};
