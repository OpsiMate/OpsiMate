import { McpServer } from '@modelcontextprotocol/server';
import { AlertAnalytics, validateFilters } from '@OpsiMate/shared';
import { z } from 'zod';
import { loadFacets } from '../alertLists';
import { dashboardAlertScope, resolveDashboardRef } from '../dashboardLookup';
import { McpDeps } from '../deps';
import { READ_ONLY_ANNOTATIONS, toolError, toolResult } from '../results';
import { filtersInputSchema, timeWindowInputShape, timeZoneInputSchema } from '../schemas';
import { resolveWindowArgs, timeZoneProblem } from '../timeWindow';

// The Insights aggregates, trimmed for a conversation: the per-name table keeps its top
// rows and the tag research drops its day series (the charts), keeping the per-value table.
const BY_NAME_MAX = 20;

const alertNameStatsSchema = z.object({
	name: z.string(),
	episodes: z.number(),
	firingNow: z.number(),
	mttrMs: z.number().nullable(),
	mtbfMs: z.number().nullable(),
	refireRate: z.number().nullable(),
	worstSeverity: z.string().nullable(),
	lastSeen: z.string(),
});

const compactAnalytics = (analytics: AlertAnalytics) => ({
	range: analytics.range,
	overview: analytics.overview,
	reliability: analytics.reliability,
	byName: analytics.byName.slice(0, BY_NAME_MAX),
	byNameTotal: analytics.byName.length,
	tagInsights: analytics.tagInsights
		? {
				key: analytics.tagInsights.key,
				values: analytics.tagInsights.values,
				taggedEpisodes: analytics.tagInsights.taggedEpisodes,
				untaggedEpisodes: analytics.tagInsights.untaggedEpisodes,
				topValues: analytics.tagInsights.topValues,
			}
		: undefined,
});

export const registerAnalyticsTools = (server: McpServer, deps: McpDeps): void => {
	server.registerTool(
		'get_alert_analytics',
		{
			title: 'Alert analytics',
			description:
				'Aggregates over the alert history for a time window (the Insights page): episode volume by day/' +
				'hour/weekday and severity, top alert names, tags and responders, reliability metrics (MTTR, MTTA, ' +
				'MTBF, re-fire rate, ack coverage) with previous-period deltas, and a per-alert-name table (top 20 by ' +
				'episodes). Scope it to a dashboard (`dashboardId` or `dashboardName`: its filters, query and, ' +
				'unless a window is given, its time range), or to explicit `filters`/`search`. No window means all ' +
				'time. `tagKey` adds a per-value breakdown for that tag. Durations are milliseconds.',
			inputSchema: z.object({
				...timeWindowInputShape,
				timeZone: timeZoneInputSchema,
				dashboardId: z.string().optional().describe('Scope to this dashboard (id from list_dashboards).'),
				dashboardName: z.string().optional().describe('Scope to this dashboard, by name (see get_dashboard).'),
				filters: filtersInputSchema.optional(),
				search: z.string().max(200).optional().describe('Scope to alerts whose name or summary contains this.'),
				tagKey: z.string().max(200).optional().describe('A tag key to break the numbers down by its values.'),
			}),
			outputSchema: z.object({
				scope: z.object({
					dashboard: z.string().optional().describe('The dashboard name when scoped to one.'),
					filters: filtersInputSchema,
					search: z.string().optional(),
					tagKey: z.string().optional(),
				}),
				range: z.object({
					from: z.string().nullable(),
					to: z.string(),
					previousFrom: z.string().nullable(),
					filtered: z.boolean(),
					granularity: z.string(),
				}),
				overview: z.record(z.string(), z.unknown()),
				reliability: z.record(z.string(), z.unknown()),
				byName: z.array(alertNameStatsSchema),
				byNameTotal: z.number(),
				tagInsights: z.record(z.string(), z.unknown()).optional(),
			}),
			annotations: READ_ONLY_ANNOTATIONS,
		},
		async ({ from, to, lastMinutes, timeZone, dashboardId, dashboardName, filters, search, tagKey }) => {
			const zoneProblem = timeZoneProblem(timeZone);
			if (zoneProblem) return toolError(zoneProblem);
			const resolvedWindow = resolveWindowArgs({ from, to, lastMinutes });
			if (!resolvedWindow.ok) return toolError(resolvedWindow.message);

			let window = resolvedWindow.window;
			let scopeFilters: Record<string, string[]> = {};
			let scopeSearch = search?.trim() || undefined;
			let dashboardLabel: string | undefined;
			if (dashboardId !== undefined || dashboardName !== undefined) {
				if (filters !== undefined || search !== undefined) {
					return toolError('Scope to a dashboard OR to filters/search, not both.');
				}
				const found = resolveDashboardRef(await deps.client.listDashboards(), {
					id: dashboardId,
					name: dashboardName,
				});
				if (!found.ok) return toolError(found.message);
				const scope = dashboardAlertScope(found.dashboard, {
					timeZone,
					resolved: false,
				});
				scopeFilters = scope.filters;
				scopeSearch = scope.search;
				dashboardLabel = found.dashboard.name;
				const explicitWindow = from !== undefined || to !== undefined || lastMinutes !== undefined;
				if (!explicitWindow) window = scope.window;
			} else if (filters !== undefined) {
				const validated = validateFilters(filters, await loadFacets(deps, 'all'));
				if (!validated.ok) return toolError(validated.problems.join('\n'));
				scopeFilters = validated.filters;
			}

			const analytics = await deps.client.getAnalytics({
				from: window.from,
				to: window.to,
				timeZone,
				filters: Object.keys(scopeFilters).length > 0 ? scopeFilters : undefined,
				search: scopeSearch,
				tagKey: tagKey?.trim() || undefined,
			});
			return toolResult({
				scope: {
					dashboard: dashboardLabel,
					filters: scopeFilters,
					search: scopeSearch,
					tagKey,
				},
				...compactAnalytics(analytics),
			});
		}
	);
};
