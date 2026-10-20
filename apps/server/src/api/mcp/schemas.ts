import { z } from 'zod';

// Input and output schemas of the MCP tools. Inputs are what an assistant fills in, so
// every field carries a description; outputs are the projections in project.ts, declared
// here so clients that read `outputSchema` can type the `structuredContent`.

// ---------- shared input pieces ----------

export const filtersInputSchema = z
	.record(z.string(), z.array(z.string()))
	.describe(
		'Filter record: field -> accepted display values (an alert matches when its value is one of them). ' +
			'Fields: status (Firing, Silenced, Muted, Resolved), severity (Critical, Warning, Info), type ' +
			'(Custom, Grafana, Datadog, ...), owner (a user\'s full name, or "Unassigned"), alertName, and ' +
			'"tagKey:<key>" for a tag (e.g. "tagKey:env"). Prefix a field with "!" to exclude instead: ' +
			'{"!status": ["Silenced"]}. Values are matched case-insensitively; call list_alert_filter_values ' +
			'to see what exists.'
	);

// The alerts time window: either an absolute [from, to] or a rolling "last N minutes".
export const timeWindowInputShape = {
	from: z.iso
		.datetime({ offset: true })
		.optional()
		.describe('Window start, ISO 8601 with offset (e.g. "2026-10-20T08:00:00Z"). Not with lastMinutes.'),
	to: z.iso
		.datetime({ offset: true })
		.optional()
		.describe('Window end, ISO 8601 with offset. Defaults to now. Not with lastMinutes.'),
	lastMinutes: z
		.number()
		.int()
		.min(1)
		.max(7 * 24 * 60)
		.optional()
		.describe('Rolling window ending now, in minutes (1..10080 = 7 days). Not with from/to.'),
};

export const includeInputSchema = z
	.enum(['active', 'resolved', 'all'])
	.describe(
		'Which list to read: "active" (firing, silenced and muted alerts), "resolved" (the archive), or ' +
			'"all" (both, as two separately paged lists).'
	);

export const limitInputSchema = z
	.number()
	.int()
	.min(1)
	.max(200)
	.default(50)
	.describe('Alerts per page, 1..200 (default 50).');

export const cursorInputSchema = z
	.string()
	.optional()
	.describe('The nextCursor of the previous page, to continue paging. Omit for the first page.');

export const timeZoneInputSchema = z
	.string()
	.max(64)
	.optional()
	.describe('IANA time zone (e.g. "Europe/London") that "today" and day buckets are computed in. Default: UTC.');

export const dashboardRefInputShape = {
	id: z.string().optional().describe('Dashboard id, as list_dashboards reports it.'),
	name: z
		.string()
		.optional()
		.describe(
			'Dashboard name instead of the id: exact match (case-insensitive), else a substring that matches one dashboard.'
		),
};

// ---------- outputs ----------

export const alertSummarySchema = z.object({
	id: z.string(),
	alertName: z.string(),
	// Display values, the same ones the filters take.
	status: z.string().describe('Firing, Silenced, Muted or Resolved.'),
	severity: z.string().describe('Critical, Warning or Info.'),
	type: z.string().describe('The source: Custom, Grafana, Datadog, GCP, UptimeKuma, Zabbix.'),
	owner: z.string().describe('Full name of the assigned user, or "Unassigned".'),
	team: z.string().nullable(),
	tags: z.record(z.string(), z.string()),
	summary: z.string().nullable(),
	startsAt: z.string().describe('ISO 8601. Inside a time window: the firing episode current at the window end.'),
	updatedAt: z.string(),
	isSilenced: z.boolean(),
	silencedUntil: z.string().nullable(),
	isMuted: z.boolean(),
	lastComment: z.string().nullable(),
	alertUrl: z.string(),
	runbookUrl: z.string().nullable(),
	links: z.array(z.object({ label: z.string(), url: z.string(), icon: z.string().optional() })),
});
export type McpAlertSummary = z.infer<typeof alertSummarySchema>;

export const alertPageSchema = z.object({
	items: z.array(alertSummarySchema),
	total: z.number().describe('Alerts matching the query, across all pages.'),
	nextCursor: z.string().nullable().describe('Pass as `cursor` to get the next page; null on the last page.'),
});
export type McpAlertPage = z.infer<typeof alertPageSchema>;

export const resolvedWindowSchema = z.object({
	from: z.string().nullable(),
	to: z.string().nullable(),
});

export const alertCountsSchema = z.object({
	total: z.number(),
	bySeverity: z.record(z.string(), z.number()),
	byStatus: z.record(z.string(), z.number()),
});
export type McpAlertCounts = z.infer<typeof alertCountsSchema>;

export const dashboardSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string().describe('"alerts" or "services".'),
	description: z.string(),
	filters: z.record(z.string(), z.array(z.string())).describe('The filter record this dashboard applies.'),
	query: z.string().describe('Free-text search over alert names and summaries; empty for none.'),
	groupBy: z.array(z.string()),
	timeRange: z
		.object({
			preset: z
				.string()
				.nullable()
				.describe('A rolling preset such as "last24h" or "today"; "custom" for fixed dates.'),
			from: z.string().nullable(),
			to: z.string().nullable(),
		})
		.nullable(),
	createdAt: z.string().nullable(),
});
export type McpDashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const alertCommentSchema = z.object({
	id: z.string(),
	author: z.string(),
	comment: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});
export type McpAlertComment = z.infer<typeof alertCommentSchema>;

export const alertHistoryEntrySchema = z.object({
	date: z.string(),
	eventType: z.string().optional(),
	status: z.string().optional(),
	actorName: z.string().optional(),
	description: z.string().optional(),
});

export const rootCauseSchema = z.object({
	alertId: z.string(),
	source: z.string(),
	content: z.string(),
	rating: z.string().nullable(),
	ratedBy: z.string().nullable(),
	ratedAt: z.string().nullable(),
	ratingComment: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const filterFieldSchema = z.object({
	field: z.string(),
	values: z.array(z.string()).describe('Most common first.'),
	totalValues: z.number(),
	truncated: z.boolean(),
});
export type McpFilterField = z.infer<typeof filterFieldSchema>;
