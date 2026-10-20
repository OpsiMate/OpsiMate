import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { knownFilterValues, STATIC_FIELD_VALUES, validateFilters } from '../../../bl/alerts/filterVocabulary';
import { AlertListName, cursorProblem, listsFor, loadFacets, queryList, toPage } from '../alertLists';
import { McpDeps } from '../deps';
import { toAlertSummary, toCommentSummary } from '../project';
import { READ_ONLY_ANNOTATIONS, toolError, toolResult } from '../results';
import {
	alertCommentSchema,
	alertHistoryEntrySchema,
	alertPageSchema,
	alertSummarySchema,
	cursorInputSchema,
	filterFieldSchema,
	filtersInputSchema,
	includeInputSchema,
	limitInputSchema,
	McpAlertPage,
	McpFilterField,
	resolvedWindowSchema,
	rootCauseSchema,
	timeWindowInputShape,
} from '../schemas';
import { resolveWindowArgs } from '../timeWindow';

// A history timeline is unbounded (every status flip and user action); an assistant
// wants the recent part.
const HISTORY_MAX_ENTRIES = 100;

export const registerAlertTools = (server: McpServer, deps: McpDeps): void => {
	server.registerTool(
		'search_alerts',
		{
			title: 'Search alerts',
			description:
				'Alerts matching a filter record, a free-text search and/or a time window — the same query the ' +
				'alerts page runs, so results agree with the UI. `filters` keys are fields (status, severity, type, ' +
				'owner, alertName, "tagKey:<key>"), values are display values such as "Critical", "Firing" or ' +
				'"Unassigned"; "!field" excludes. Values match case-insensitively: an unknown field, status, severity ' +
				'or type is rejected with the known ones listed, while owner, alertName and tag values are free text ' +
				'(an unknown one matches nothing). list_alert_filter_values shows what exists. `search` matches ' +
				'alert names and summaries. Reads the ' +
				'active list by default; include "resolved" for the archive, "all" for both (each paged on its own). ' +
				'Sorted by startsAt, newest first, unless `sort`/`dir` say otherwise.',
			inputSchema: z.object({
				filters: filtersInputSchema.optional(),
				search: z.string().max(200).optional().describe('Free text matched against alert names and summaries.'),
				...timeWindowInputShape,
				include: includeInputSchema.default('active'),
				sort: z
					.enum(['startsAt', 'updatedAt', 'alertName', 'severity', 'status', 'type', 'owner', 'summary'])
					.optional()
					.describe('Sort field (default startsAt).'),
				dir: z.enum(['asc', 'desc']).optional().describe('Sort direction (default desc).'),
				limit: limitInputSchema,
				cursor: cursorInputSchema,
			}),
			outputSchema: z.object({
				include: includeInputSchema,
				window: resolvedWindowSchema,
				filters: filtersInputSchema,
				total: z.number().describe('Matching alerts across the included lists.'),
				active: alertPageSchema.optional(),
				resolved: alertPageSchema.optional(),
			}),
			annotations: READ_ONLY_ANNOTATIONS,
		},
		async ({ filters, search, from, to, lastMinutes, include, sort, dir, limit, cursor }) => {
			const resolvedWindow = resolveWindowArgs({ from, to, lastMinutes });
			if (!resolvedWindow.ok) return toolError(resolvedWindow.message);
			if (include === 'all' && cursor !== undefined) {
				return toolError('A cursor pages one list: call again with include "active" or "resolved".');
			}
			const badCursor = cursorProblem(cursor);
			if (badCursor) return toolError(badCursor);
			const validated = validateFilters(filters ?? {}, await loadFacets(deps, include));
			if (!validated.ok) return toolError(validated.problems.join('\n'));
			const owners = await deps.alertBL.getOwners();

			const pages: Partial<Record<AlertListName, McpAlertPage>> = {};
			for (const list of listsFor(include)) {
				const page = await queryList(deps, list, {
					filters: validated.filters,
					search: search?.trim() || undefined,
					from: resolvedWindow.window.from,
					to: resolvedWindow.window.to,
					sort,
					dir,
					limit,
					cursor,
				});
				pages[list] = toPage(page.items, page.total, page.nextCursor, owners);
			}
			return toolResult({
				include,
				window: resolvedWindow.window,
				filters: validated.filters,
				total: Object.values(pages).reduce((sum, page) => sum + page.total, 0),
				...pages,
			});
		}
	);

	server.registerTool(
		'get_alert',
		{
			title: 'Get an alert',
			description:
				'One alert by id with everything known about it: the alert itself (from the active list, or the ' +
				'resolved archive when it has resolved), its comments with author names, its history timeline ' +
				'(status changes and user actions, newest first, at most 100 entries) and the root-cause analysis ' +
				'if one was pushed for it.',
			inputSchema: z.object({
				id: z.string().describe('The alert id (as search_alerts and get_dashboard_alerts report it).'),
				includeComments: z.boolean().default(true),
				includeHistory: z.boolean().default(true),
				includeRootCause: z.boolean().default(true),
			}),
			outputSchema: z.object({
				alert: alertSummarySchema,
				resolved: z.boolean().describe('True when the alert came from the resolved archive.'),
				comments: z.array(alertCommentSchema).optional(),
				history: z.array(alertHistoryEntrySchema).optional(),
				rootCause: rootCauseSchema.nullable().optional().describe('null when no analysis was pushed.'),
			}),
			annotations: READ_ONLY_ANNOTATIONS,
		},
		async ({ id, includeComments, includeHistory, includeRootCause }) => {
			const found = await deps.alertBL.findAlertById(id);
			if (!found) {
				return toolError(`No alert with id "${id}" in the active list or the resolved archive.`);
			}
			const owners = await deps.alertBL.getOwners();
			const [comments, history, rootCause] = await Promise.all([
				includeComments ? deps.alertBL.getCommentsByAlertId(id) : undefined,
				includeHistory ? deps.alertBL.getAlertHistory(id) : undefined,
				includeRootCause ? deps.rootCauseBL.get(id) : undefined,
			]);
			return toolResult({
				alert: toAlertSummary(found.alert, owners),
				resolved: found.resolved,
				comments: comments?.map((comment) => toCommentSummary(comment, owners)),
				history: history?.data.slice(0, HISTORY_MAX_ENTRIES),
				rootCause,
			});
		}
	);

	server.registerTool(
		'list_alert_filter_values',
		{
			title: 'Filter fields and values',
			description:
				'Every filterable field with the values alerts currently carry (most common first), including one ' +
				'"tagKey:<key>" field per tag key — the vocabulary for the `filters` argument of search_alerts and ' +
				'get_alert_analytics. Fixed values (status: Firing, Silenced, Muted, Resolved; severity: Critical, ' +
				'Warning, Info) are listed even when no alert has them right now.',
			inputSchema: z.object({
				include: includeInputSchema.default('all'),
				maxValuesPerField: z
					.number()
					.int()
					.min(1)
					.max(500)
					.default(50)
					.describe('Values listed per field (default 50); `truncated` says when there were more.'),
			}),
			outputSchema: z.object({
				include: includeInputSchema,
				totalAlerts: z.number(),
				fields: z.array(filterFieldSchema),
				tagKeys: z.array(z.string()),
			}),
			annotations: READ_ONLY_ANNOTATIONS,
		},
		async ({ include, maxValuesPerField }) => {
			const facets = await loadFacets(deps, include);
			const fieldNames = [...new Set([...Object.keys(STATIC_FIELD_VALUES), ...Object.keys(facets.facets)])];
			const fields: McpFilterField[] = fieldNames.map((field) => {
				const counts = facets.facets[field] ?? {};
				// Live values by frequency, then the fixed ones nothing carries right now.
				const ordered = [
					...Object.entries(counts)
						.sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
						.map(([value]) => value),
					...knownFilterValues(field, facets).filter((value) => !(value in counts)),
				];
				return {
					field,
					values: ordered.slice(0, maxValuesPerField),
					totalValues: ordered.length,
					truncated: ordered.length > maxValuesPerField,
				};
			});
			return toolResult({
				include,
				totalAlerts: facets.total,
				fields,
				tagKeys: facets.tagKeys.map((tagKey) => tagKey.key),
			});
		}
	);
};
