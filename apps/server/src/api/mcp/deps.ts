import { AlertBL } from '../../bl/alerts/alert.bl';
import { DashboardBL } from '../../bl/dashboards/dashboard.bl.ts';
import { RootCauseBL } from '../../bl/rootCause/rootCause.bl';

// What the MCP tools read from. Every tool is a projection over the same business layer
// the REST API serves, so an assistant can never see something the UI would not show.
export interface McpDeps {
	alertBL: AlertBL;
	dashboardBL: DashboardBL;
	rootCauseBL: RootCauseBL;
	// Reported to MCP clients as the server version (APP_VERSION, 'dev' locally).
	version: string;
}
