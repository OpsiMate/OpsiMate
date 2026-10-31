import { OpsiMateClient } from '../opsimate/client';

// What the MCP tools read from: OpsiMate's REST API, called with the caller's own
// credentials (see opsimate/auth.ts), so an assistant can never see something the same
// user would not see in the UI.
export interface McpDeps {
	client: OpsiMateClient;
	// Reported to MCP clients as the server version (APP_VERSION, 'dev' locally).
	version: string;
}
