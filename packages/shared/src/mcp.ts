// The MCP server (apps/mcp, its own container) as clients see it: the path it serves at and
// the tools it offers. One list for the server (which registers them), its tests (which
// check the registered set is exactly this one) and the Settings guide (which describes
// them to the person connecting an assistant), so none of the three can drift.

export const MCP_PATH = '/mcp';
// The port the mcp container publishes by default (docker-compose, Helm).
export const MCP_DEFAULT_PORT = 3100;

export interface McpToolInfo {
	name: string;
	// The tool's `title` as the server registers it.
	title: string;
	// One sentence for the guide: what a person gets from it.
	summary: string;
}

export const MCP_TOOLS: readonly McpToolInfo[] = [
	{
		name: 'list_dashboards',
		title: 'List dashboards',
		summary: 'The saved dashboards: each one is a filter record, an optional search and a time range.',
	},
	{
		name: 'get_dashboard',
		title: 'Get a dashboard',
		summary: 'One dashboard by id or name, with the concrete time window its preset means right now.',
	},
	{
		name: 'get_dashboard_alerts',
		title: 'Alerts of a dashboard',
		summary:
			'What a dashboard shows right now — active, resolved or both — paged, with counts by severity and status.',
	},
	{
		name: 'search_alerts',
		title: 'Search alerts',
		summary: 'Alerts by filters, free text and time window: the same query the alerts page runs.',
	},
	{
		name: 'get_alert',
		title: 'Get an alert',
		summary: 'One alert with its comments, history timeline and root-cause analysis.',
	},
	{
		name: 'list_alert_filter_values',
		title: 'Filter fields and values',
		summary: 'Every filterable field and the values alerts carry right now — the vocabulary for search_alerts.',
	},
	{
		name: 'get_alert_analytics',
		title: 'Alert analytics',
		summary:
			'The Insights aggregates for a window: volume, top names, MTTR/MTBF, optionally scoped to a dashboard.',
	},
];
