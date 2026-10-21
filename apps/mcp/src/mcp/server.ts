import { McpServer } from '@modelcontextprotocol/server';
import { McpDeps } from './deps';
import { registerAlertTools } from './tools/alerts';
import { registerAnalyticsTools } from './tools/analytics';
import { registerDashboardTools } from './tools/dashboards';

// What a client sees at initialize time; read by the assistant before any tool call, so it
// answers the two things every tool description would otherwise have to repeat.
const INSTRUCTIONS =
	'OpsiMate alerts, read-only: ids are strings, and a dashboard is a saved filter + search + time range that ' +
	'defines which alerts it shows. Start with list_dashboards to find the view a user means, or with ' +
	'list_alert_filter_values to learn the filter vocabulary before search_alerts.';

// One McpServer per request (HTTP is stateless; stdio builds one per connection):
// registering seven tools is cheap, and nothing is held between calls.
export const createMcpServer = (deps: McpDeps): McpServer => {
	const server = new McpServer(
		{ name: 'opsimate', title: 'OpsiMate', version: deps.version },
		{ instructions: INSTRUCTIONS }
	);
	registerDashboardTools(server, deps);
	registerAlertTools(server, deps);
	registerAnalyticsTools(server, deps);
	return server;
};
