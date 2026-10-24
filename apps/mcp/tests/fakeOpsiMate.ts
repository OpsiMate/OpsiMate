import {
	Alert,
	AlertAnalytics,
	AlertComment,
	AlertHistory,
	AlertHistoryEventType,
	AlertListFilters,
	AlertListQuery,
	AlertOwnerInfo,
	AlertRootCause,
	AlertSeverity,
	AlertStatus,
	applyAlertListQuery,
	computeAlertFacets,
	Dashboard,
} from '@OpsiMate/shared';
import express, { Express, NextFunction, Request, Response } from 'express';
import http from 'node:http';
import { AddressInfo } from 'node:net';

// A stand-in for OpsiMate's REST API, serving fixtures through the SAME query engine the
// real server uses (applyAlertListQuery, computeAlertFacets from shared), so paging,
// filters, time windows and facets behave as they do in production. It records every
// request's credentials so tests can check what the MCP server forwarded.

export const API_TOKEN = 'fixture-api-token';
export const VIEWER_JWT = 'viewer-jwt-fixture';
export const ADMIN_JWT = 'admin-jwt-fixture';

export interface SeenRequest {
	path: string;
	// The credential header OpsiMate received: 'x-api-token: …' or 'authorization: …'.
	credential: string | null;
	query: Record<string, string>;
}

export interface FakeOpsiMate {
	url: string;
	seen: SeenRequest[];
	close(): Promise<void>;
}

const HOUR_MS = 60 * 60 * 1000;
export const ago = (hours: number, now = Date.now()): string => new Date(now - hours * HOUR_MS).toISOString();

export const owners: AlertOwnerInfo[] = [
	{ id: '1', fullName: 'Dana Levi' },
	{ id: '2', fullName: 'Noa Peretz' },
];

const alert = (
	id: string,
	name: string,
	severity: AlertSeverity,
	hoursAgo: number,
	extra: Partial<Alert> = {}
): Alert => ({
	id,
	type: 'Custom',
	status: AlertStatus.FIRING,
	severity,
	tags: { env: 'prod', severity },
	startsAt: ago(hoursAgo),
	updatedAt: ago(hoursAgo - 0.1),
	alertUrl: '',
	alertName: name,
	summary: `${name} summary`,
	createdAt: ago(hoursAgo),
	isSilenced: false,
	...extra,
});

export const activeAlerts: Alert[] = [
	alert('recent-crit', 'DB down', AlertSeverity.CRITICAL, 1, { ownerId: '1', lastComment: 'looking into it' }),
	alert('old-crit', 'Old outage', AlertSeverity.CRITICAL, 48),
	alert('recent-warn', 'Disk 80%', AlertSeverity.WARNING, 1, { tags: { env: 'prod', team: 'platform' } }),
	alert('silenced-info', 'Flaky test', AlertSeverity.INFO, 2, { isSilenced: true, tags: { env: 'staging' } }),
	...[1, 2, 3, 4, 5].map((i) =>
		alert(`page-${i}`, `Paged ${i}`, AlertSeverity.INFO, i + 2, { tags: { env: 'prod', team: 'search' } })
	),
];

export const resolvedAlerts: Alert[] = [
	alert('resolved-crit', 'API 5xx spike', AlertSeverity.CRITICAL, 3, {
		status: AlertStatus.RESOLVED,
		isResolved: true,
		ownerId: '2',
	}),
];

export const dashboards: Dashboard[] = [
	{
		id: '1',
		type: 'alerts',
		name: 'Prod Critical',
		description: 'Critical alerts of the last day',
		filters: { severity: ['Critical'], 'tagKey:env': ['prod'], junk: 'ignored' },
		visibleColumns: ['alertName'],
		query: '',
		groupBy: [],
		timeRange: { from: null, to: null, preset: 'last24h' },
	},
	{
		id: '2',
		type: 'alerts',
		name: 'Platform warnings',
		filters: { severity: ['Warning'], 'tagKey:team': ['platform'] },
		visibleColumns: ['alertName'],
		query: '',
		groupBy: [],
		timeRange: { from: null, to: null, preset: 'last7d' },
	},
];

export const comments: Record<string, AlertComment[]> = {
	'recent-crit': [
		{
			id: 'c1',
			alertId: 'recent-crit',
			userId: '1',
			comment: 'looking into it',
			createdAt: ago(0.5),
			updatedAt: ago(0.5),
		},
	],
};

export const histories: Record<string, AlertHistory> = {
	'recent-crit': {
		alertId: 'recent-crit',
		data: [
			{
				date: ago(0.5),
				eventType: AlertHistoryEventType.COMMENT_ADDED,
				actorName: 'Dana Levi',
				description: 'Comment added',
			},
			{ date: ago(1), status: AlertStatus.FIRING, eventType: AlertHistoryEventType.STATUS_CHANGED },
		],
	},
};

export const rootCauses: Record<string, AlertRootCause> = {
	'recent-crit': {
		alertId: 'recent-crit',
		source: 'api',
		content: 'Disk full on db-1',
		rating: null,
		ratedBy: null,
		ratedAt: null,
		ratingComment: null,
		createdAt: ago(0.4),
		updatedAt: ago(0.4),
	},
};

const parseFilters = (raw: unknown): AlertListFilters =>
	typeof raw === 'string' ? (JSON.parse(raw) as AlertListFilters) : {};

const queryFromParams = (q: Record<string, unknown>): AlertListQuery => ({
	filters: parseFilters(q.filters),
	from: typeof q.from === 'string' ? q.from : null,
	to: typeof q.to === 'string' ? q.to : null,
	search: typeof q.search === 'string' ? q.search : undefined,
	sort: typeof q.sort === 'string' ? q.sort : undefined,
	dir: q.dir === 'asc' || q.dir === 'desc' ? q.dir : undefined,
	limit: typeof q.limit === 'string' ? Number(q.limit) : undefined,
	cursor: typeof q.cursor === 'string' ? q.cursor : undefined,
});

const pageBody = (alerts: Alert[], q: Record<string, unknown>) => {
	const page = applyAlertListQuery(alerts, owners, queryFromParams(q));
	return { alerts: page.items, total: page.total, nextCursor: page.nextCursor };
};

export const startFakeOpsiMate = async (): Promise<FakeOpsiMate> => {
	const seen: SeenRequest[] = [];
	const app: Express = express();
	app.use((req: Request, res: Response, next: NextFunction) => {
		const apiToken = req.header('x-api-token');
		const authorization = req.header('authorization');
		const credential = apiToken
			? `x-api-token: ${apiToken}`
			: authorization
				? `authorization: ${authorization}`
				: null;
		seen.push({
			path: req.path,
			credential,
			query: Object.fromEntries(
				Object.entries(req.query).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
			),
		});
		const ok =
			apiToken === API_TOKEN ||
			authorization === `Bearer ${VIEWER_JWT}` ||
			authorization === `Bearer ${ADMIN_JWT}`;
		if (!ok) {
			res.status(401).json({ success: false, error: 'Missing Authorization header or API token' });
			return;
		}
		next();
	});
	const data = (res: Response, payload: unknown) => res.json({ success: true, data: payload });

	app.get('/api/v1/dashboards', (_req, res) => data(res, dashboards));
	app.get('/api/v1/dashboards/:id', (req, res) => {
		const found = dashboards.find((d) => d.id === req.params.id);
		if (!found) return res.status(404).json({ success: false, error: 'Dashboard not found' });
		return data(res, found);
	});
	app.get('/api/v1/alerts', (req, res) => data(res, pageBody(activeAlerts, req.query)));
	app.get('/api/v1/alerts/resolved', (req, res) => data(res, pageBody(resolvedAlerts, req.query)));
	app.get('/api/v1/alerts/facets', (req, res) =>
		data(res, computeAlertFacets(activeAlerts, parseFilters(req.query.filters), undefined, owners))
	);
	app.get('/api/v1/alerts/resolved/facets', (req, res) =>
		data(res, computeAlertFacets(resolvedAlerts, parseFilters(req.query.filters), undefined, owners))
	);
	app.get('/api/v1/alerts/owners', (_req, res) => data(res, owners));
	app.get('/api/v1/alerts/analytics', (req, res) => {
		const q = req.query as Record<string, string | undefined>;
		const analytics = {
			range: {
				from: q.from ?? null,
				to: q.to ?? new Date().toISOString(),
				previousFrom: null,
				filtered: q.filters !== undefined || q.search !== undefined,
				granularity: 'day',
			},
			overview: { totalEpisodes: { value: 2, previous: 0 }, firingNow: 1 },
			reliability: { mttrMs: null },
			byName: [
				{
					name: 'DB down',
					episodes: 2,
					firingNow: 1,
					mttrMs: null,
					mtbfMs: null,
					refireRate: null,
					worstSeverity: 'critical',
					lastSeen: ago(1),
				},
			],
			tagInsights: q.tagKey
				? { key: q.tagKey, values: 1, taggedEpisodes: 2, untaggedEpisodes: 0, topValues: [] }
				: undefined,
		} as unknown as AlertAnalytics;
		return data(res, analytics);
	});
	app.get('/api/v1/alerts/:id', (req, res) => {
		const active = activeAlerts.find((a) => a.id === req.params.id);
		if (active) return data(res, { alert: active, resolved: false });
		const resolved = resolvedAlerts.find((a) => a.id === req.params.id);
		if (resolved) return data(res, { alert: resolved, resolved: true });
		return res.status(404).json({ success: false, error: 'Alert not found' });
	});
	app.get('/api/v1/alerts/:id/comments', (req, res) => data(res, { comments: comments[req.params.id] ?? [] }));
	app.get('/api/v1/alerts/:id/history', (req, res) =>
		data(res, histories[req.params.id] ?? { alertId: req.params.id, data: [] })
	);
	app.get('/api/v1/alerts/:id/root-cause', (req, res) => data(res, { rootCause: rootCauses[req.params.id] ?? null }));

	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	return {
		url: `http://127.0.0.1:${port}`,
		seen,
		close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
	};
};
