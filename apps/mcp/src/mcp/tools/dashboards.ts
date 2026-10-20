import { McpServer } from '@modelcontextprotocol/server';
import { Alert, DASHBOARD_TYPES } from '@OpsiMate/shared';
import { z } from 'zod';
import { AlertListName, countAlerts, listsFor, queryAll, queryList, toPage } from '../alertLists';
import {
	DashboardAlertScope,
	dashboardAlertScope,
	describeDashboardScope,
	resolveDashboardRef,
	resolveDashboardWindow,
} from '../dashboardLookup';
import { McpDeps } from '../deps';
import { toDashboardSummary } from '../project';
import { READ_ONLY_ANNOTATIONS, toolError, toolResult } from '../results';
import {
	alertCountsSchema,
	alertPageSchema,
	cursorInputSchema,
	dashboardRefInputShape,
	dashboardSummarySchema,
	includeInputSchema,
	limitInputSchema,
	McpAlertCounts,
	McpAlertPage,
	resolvedWindowSchema,
	timeZoneInputSchema,
} from '../schemas';
import { timeZoneProblem } from '../timeWindow';

// Above this many matching alerts the per-severity/status summary is skipped: it needs
// the whole result set, and the point of the tool is to answer without one.
const SUMMARY_MAX_ALERTS = 20_000;

export const registerDashboardTools = (server: McpServer, deps: McpDeps): void => {
	server.registerTool(
		'list_dashboards',
		{
			title: 'List dashboards',
			description:
				'Lists the saved dashboards. A dashboard is a saved view of the alerts list: a filter record, an ' +
				'optional free-text query and a time range (rolling presets such as "last24h"). Use it to find the ' +
				'dashboard a user means by name, then get_dashboard_alerts to read what it shows.',
			inputSchema: z.object({
				type: z
					.enum(DASHBOARD_TYPES)
					.optional()
					.describe('Only dashboards of this type ("alerts" or "services"). Default: all.'),
			}),
			outputSchema: z.object({ dashboards: z.array(dashboardSummarySchema) }),
			annotations: READ_ONLY_ANNOTATIONS,
		},
		async ({ type }) => {
			const dashboards = await deps.client.listDashboards();
			return toolResult({
				dashboards: dashboards
					.filter((dashboard) => type === undefined || dashboard.type === type)
					.map(toDashboardSummary),
			});
		}
	);

	server.registerTool(
		'get_dashboard',
		{
			title: 'Get a dashboard',
			description:
				'One dashboard by id or name, with its filters, query, the concrete time window its preset means ' +
				'right now, and a plain-English description of what it shows. Name matching is case-insensitive: an ' +
				'exact name wins, otherwise a substring that matches exactly one dashboard.',
			inputSchema: z.object({
				...dashboardRefInputShape,
				timeZone: timeZoneInputSchema,
			}),
			outputSchema: z.object({
				dashboard: dashboardSummarySchema,
				window: resolvedWindowSchema,
				description: z.string(),
			}),
			annotations: READ_ONLY_ANNOTATIONS,
		},
		async ({ id, name, timeZone }) => {
			const zoneProblem = timeZoneProblem(timeZone);
			if (zoneProblem) return toolError(zoneProblem);
			const found = resolveDashboardRef(await deps.client.listDashboards(), {
				id,
				name,
			});
			if (!found.ok) return toolError(found.message);
			const window = resolveDashboardWindow(found.dashboard, timeZone);
			return toolResult({
				dashboard: toDashboardSummary(found.dashboard),
				window,
				description: describeDashboardScope(found.dashboard, window),
			});
		}
	);

	server.registerTool(
		'get_dashboard_alerts',
		{
			title: 'Alerts of a dashboard',
			description:
				'The alerts a dashboard shows right now: its filters, query and time range applied to the active ' +
				'list (include "active", the default), the resolved archive ("resolved" — the dashboard\'s status ' +
				'filter is suspended there, as in the UI), or both ("all"). Pages of `limit` alerts, newest first; ' +
				'pass the page\'s nextCursor as `cursor` to continue (with "all", page one list at a time by ' +
				'calling again with include "active" or "resolved"). `summary` counts every matching alert by ' +
				'severity and status, so the total picture never needs paging.',
			inputSchema: z.object({
				...dashboardRefInputShape,
				include: includeInputSchema.default('active'),
				limit: limitInputSchema,
				cursor: cursorInputSchema,
				timeZone: timeZoneInputSchema,
			}),
			outputSchema: z.object({
				dashboard: dashboardSummarySchema,
				include: includeInputSchema,
				window: resolvedWindowSchema,
				active: alertPageSchema.optional(),
				resolved: alertPageSchema.optional(),
				summary: alertCountsSchema.optional(),
				summaryNote: z.string().optional(),
			}),
			annotations: READ_ONLY_ANNOTATIONS,
		},
		async ({ id, name, include, limit, cursor, timeZone }) => {
			const zoneProblem = timeZoneProblem(timeZone);
			if (zoneProblem) return toolError(zoneProblem);
			if (include === 'all' && cursor !== undefined) {
				return toolError('A cursor pages one list: call again with include "active" or "resolved".');
			}
			const found = resolveDashboardRef(await deps.client.listDashboards(), {
				id,
				name,
			});
			if (!found.ok) return toolError(found.message);
			const { dashboard } = found;
			const owners = await deps.client.getOwners();

			const pages: Partial<Record<AlertListName, McpAlertPage>> = {};
			const scopes = new Map<AlertListName, DashboardAlertScope>();
			for (const list of listsFor(include)) {
				const scope = dashboardAlertScope(dashboard, {
					timeZone,
					resolved: list === 'resolved',
				});
				scopes.set(list, scope);
				const page = await queryList(deps, list, {
					filters: scope.filters,
					search: scope.search,
					from: scope.window.from,
					to: scope.window.to,
					limit,
					cursor,
				});
				pages[list] = toPage(page.items, page.total, page.nextCursor, owners);
			}

			// The summary walks the whole result in pages of 1000 (OpsiMate serves them from
			// its query cache), skipped when the set is too large to be worth holding.
			const total = Object.values(pages).reduce((sum, page) => sum + page.total, 0);
			let summary: McpAlertCounts | undefined;
			let summaryNote: string | undefined;
			if (total > SUMMARY_MAX_ALERTS) {
				summaryNote = `Summary skipped: ${total} alerts match, more than the ${SUMMARY_MAX_ALERTS} the summary covers.`;
			} else {
				const everything: Alert[] = [];
				for (const [list, scope] of scopes) {
					everything.push(
						...(await queryAll(
							deps,
							list,
							{
								filters: scope.filters,
								search: scope.search,
								from: scope.window.from,
								to: scope.window.to,
							},
							SUMMARY_MAX_ALERTS
						))
					);
				}
				summary = countAlerts(everything, owners);
			}

			return toolResult({
				dashboard: toDashboardSummary(dashboard),
				include,
				window: resolveDashboardWindow(dashboard, timeZone),
				...pages,
				summary,
				summaryNote,
			});
		}
	);
};
