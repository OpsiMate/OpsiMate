import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { Dashboard } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import express from 'express';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { resolveDashboardRef } from '../src/api/mcp/dashboardLookup';
import { mcpEnabled } from '../src/api/mcp/router';
import { McpAlertCounts, McpAlertPage, McpAlertSummary, McpDashboardSummary } from '../src/api/mcp/schemas';
import { AppMode, createApp } from '../src/app';
import { getSecurityConfig } from '../src/config/config';
import { setupDB } from './setup';

// The MCP endpoint end to end: a real app on a real port, driven by the official MCP client
// over Streamable HTTP, with data seeded through the REST API the way an installation's is.

const TOOL_NAMES = [
	'get_alert',
	'get_alert_analytics',
	'get_dashboard',
	'get_dashboard_alerts',
	'list_alert_filter_values',
	'list_dashboards',
	'search_alerts',
];

interface DashboardsResult {
	dashboards: McpDashboardSummary[];
}

interface DashboardResult {
	dashboard: McpDashboardSummary;
	description: string;
}

interface AlertListsResult {
	include: string;
	total?: number;
	active?: McpAlertPage;
	resolved?: McpAlertPage;
	summary?: McpAlertCounts;
	summaryNote?: string;
}

interface CommentRow {
	author: string;
	comment: string;
}

interface HistoryRow {
	eventType?: string;
	description?: string;
}

interface RootCauseRow {
	content: string;
}

interface AlertResult {
	alert: McpAlertSummary;
	resolved: boolean;
	comments?: CommentRow[];
	history?: HistoryRow[];
	rootCause?: RootCauseRow | null;
}

interface FilterFieldRow {
	field: string;
	values: string[];
}

interface FilterValuesResult {
	fields: FilterFieldRow[];
	tagKeys: string[];
}

interface AnalyticsScope {
	dashboard?: string;
}

interface AlertNameRow {
	name: string;
	episodes: number;
}

interface AnalyticsResult {
	scope: AnalyticsScope;
	byName: AlertNameRow[];
}

const HOUR_MS = 60 * 60 * 1000;
const ago = (hours: number): string => new Date(Date.now() - hours * HOUR_MS).toISOString();

let db: Database.Database;
let app: express.Application;
let server: http.Server;
let mcpUrl: URL;
let apiToken: string;
let adminJwt: string;
let viewerJwt: string;
let dashboardId: string;
let client: Client;

const connect = async (headers: Record<string, string>): Promise<Client> => {
	const mcpClient = new Client({ name: 'mcp-test', version: '0.0.0' });
	await mcpClient.connect(new StreamableHTTPClientTransport(mcpUrl, { requestInit: { headers } }));
	return mcpClient;
};

const call = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
	const result = await client.callTool({ name, arguments: args });
	expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
	expect(result.structuredContent).toBeDefined();
	return result.structuredContent as T;
};

const callError = async (name: string, args: Record<string, unknown>): Promise<string> => {
	const result = await client.callTool({ name, arguments: args });
	expect(result.isError).toBe(true);
	const [first] = result.content;
	return first.type === 'text' ? first.text : '';
};

const ids = (page: McpAlertPage | undefined): string[] => (page?.items ?? []).map((alert) => alert.id);

beforeAll(async () => {
	db = await setupDB();
	const created = await createApp(db, AppMode.SERVER);
	if (!created) throw new Error('createApp returned no app');
	app = created;
	server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	mcpUrl = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/mcp`);
	apiToken = getSecurityConfig().api_token;
	const api = request(app);

	// Users: the first registration is the admin; a Viewer is created by them.
	await api
		.post('/api/v1/users/register')
		.send({ email: 'mcp-admin@example.com', fullName: 'MCP Admin', password: 'password123' });
	adminJwt = (await api.post('/api/v1/users/login').send({ email: 'mcp-admin@example.com', password: 'password123' }))
		.body.token as string;
	await api
		.post('/api/v1/users')
		.set('Authorization', `Bearer ${adminJwt}`)
		.send({ email: 'mcp-viewer@example.com', fullName: 'MCP Viewer', password: 'password123', role: 'viewer' });
	viewerJwt = (
		await api.post('/api/v1/users/login').send({ email: 'mcp-viewer@example.com', password: 'password123' })
	).body.token as string;

	// Alerts through the custom webhook: one recent critical (the dashboard's match), one
	// critical too old for its last24h window, one recent warning, and five for paging.
	const fire = (body: Record<string, unknown>) =>
		api.post('/api/v1/alerts/custom').set('x-api-token', apiToken).send(body).expect(200);
	await fire({
		id: 'mcp-recent-crit',
		alertName: 'DB down',
		severity: 'critical',
		tags: { env: 'prod' },
		startsAt: ago(1),
	});
	await fire({
		id: 'mcp-old-crit',
		alertName: 'Old outage',
		severity: 'critical',
		tags: { env: 'prod' },
		startsAt: ago(48),
		updatedAt: ago(48),
	});
	await fire({
		id: 'mcp-recent-warn',
		alertName: 'Disk 80%',
		severity: 'warning',
		tags: { env: 'prod' },
		startsAt: ago(1),
	});
	for (let i = 1; i <= 5; i++) {
		await fire({
			id: `mcp-page-${i}`,
			alertName: `Paged ${i}`,
			severity: 'info',
			tags: { team: 'search' },
			startsAt: ago(i),
		});
	}
	await api
		.post('/api/v1/alerts/mcp-recent-crit/comments')
		.set('Authorization', `Bearer ${adminJwt}`)
		.send({ comment: 'looking into it' })
		.expect(201);
	await api
		.put('/api/v1/alerts/mcp-recent-crit/root-cause')
		.set('x-api-token', apiToken)
		.send({ content: 'Disk full on db-1' })
		.expect(200);

	const dashboard = await api
		.post('/api/v1/dashboards')
		.set('Authorization', `Bearer ${adminJwt}`)
		.send({
			name: 'Prod Critical',
			type: 'alerts',
			description: 'Critical alerts of the last day',
			filters: { severity: ['Critical'], junk: 'ignored' },
			visibleColumns: ['alertName'],
			query: '',
			groupBy: [],
			timeRange: { from: null, to: null, preset: 'last24h' },
		})
		.expect(200);
	dashboardId = String(dashboard.body.data.id);

	client = await connect({ 'x-api-token': apiToken });
});

afterAll(async () => {
	await client.close();
	await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	db.close();
});

describe('reaching the endpoint', () => {
	const initialize = {
		jsonrpc: '2.0',
		id: 1,
		method: 'initialize',
		params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '0' } },
	};

	test('no credentials: 401 before anything is parsed', async () => {
		const res = await fetch(mcpUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
			body: JSON.stringify(initialize),
		});
		expect(res.status).toBe(401);
	});

	test('a Viewer JWT is accepted (every tool only reads)', async () => {
		const viewer = await connect({ Authorization: `Bearer ${viewerJwt}` });
		try {
			const { tools } = await viewer.listTools();
			expect(tools.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
		} finally {
			await viewer.close();
		}
	});

	test('tools/list is the seven read-only tools, each with an output schema', async () => {
		const { tools } = await client.listTools();
		expect(tools.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
		for (const tool of tools) {
			expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
			expect(tool.outputSchema, tool.name).toBeDefined();
			expect(tool.description, tool.name).toBeTruthy();
		}
		expect(client.getInstructions()).toContain('list_dashboards');
	});

	test('GET and DELETE on the endpoint answer without a server error', async () => {
		const headers = { 'x-api-token': apiToken, accept: 'application/json, text/event-stream' };
		expect((await fetch(mcpUrl, { method: 'GET', headers })).status).toBeLessThan(500);
		expect((await fetch(mcpUrl, { method: 'DELETE', headers })).status).toBeLessThan(500);
	});

	test('MCP_ENABLED=false removes the endpoint', async () => {
		expect(mcpEnabled({})).toBe(true);
		expect(mcpEnabled({ MCP_ENABLED: 'true' })).toBe(true);
		expect(mcpEnabled({ MCP_ENABLED: 'False' })).toBe(false);

		const saved = process.env.MCP_ENABLED;
		process.env.MCP_ENABLED = 'false';
		const offDb = await setupDB();
		try {
			const offApp = await createApp(offDb, AppMode.SERVER);
			if (!offApp) throw new Error('createApp returned no app');
			const res = await request(offApp).post('/api/mcp').set('x-api-token', apiToken).send(initialize);
			expect(res.status).toBe(404);
		} finally {
			if (saved === undefined) delete process.env.MCP_ENABLED;
			else process.env.MCP_ENABLED = saved;
			offDb.close();
		}
	});
});

describe('dashboards', () => {
	test('list_dashboards and get_dashboard by exact, case-insensitive and partial name', async () => {
		const { dashboards } = await call<DashboardsResult>('list_dashboards', {});
		expect(dashboards.map((dashboard) => dashboard.name)).toEqual(['Prod Critical']);
		expect(dashboards[0]).toMatchObject({
			id: dashboardId,
			filters: { severity: ['Critical'] },
			timeRange: { preset: 'last24h' },
		});
		expect(dashboards[0]).not.toHaveProperty('visibleColumns');

		const byId = await call<DashboardResult>('get_dashboard', { id: dashboardId });
		expect(byId.dashboard.name).toBe('Prod Critical');
		expect(byId.description).toContain('severity is "Critical"');
		expect(byId.description).toContain('last 24 hours');
		const byName = await call<DashboardResult>('get_dashboard', { name: 'prod critical' });
		expect(byName.dashboard.id).toBe(dashboardId);
		const bySubstring = await call<DashboardResult>('get_dashboard', { name: 'CRITICAL' });
		expect(bySubstring.dashboard.id).toBe(dashboardId);

		expect(await callError('get_dashboard', { name: 'staging' })).toContain('"Prod Critical"');
		expect(await callError('get_dashboard', { id: '999999' })).toContain('999999');
		expect(await callError('get_dashboard', { timeZone: 'Mars/Olympus' })).toContain('Mars/Olympus');
	});

	test('get_dashboard_alerts applies the filters and the rolling window, with a summary', async () => {
		const result = await call<AlertListsResult>('get_dashboard_alerts', { name: 'Prod Critical' });
		expect(ids(result.active)).toEqual(['mcp-recent-crit']);
		expect(result.active?.total).toBe(1);
		expect(result.resolved).toBeUndefined();
		expect(result.summary).toEqual({ total: 1, bySeverity: { Critical: 1 }, byStatus: { Firing: 1 } });
		expect(result.active?.items[0]).toMatchObject({ severity: 'Critical', status: 'Firing', owner: 'Unassigned' });
		expect(result.active?.items[0]).not.toHaveProperty('ownerId');
	});

	test('include "resolved" reads the archive after a resolve webhook', async () => {
		await request(app)
			.post('/api/v1/alerts/custom')
			.set('x-api-token', apiToken)
			.send({ id: 'mcp-recent-crit', status: 'resolved' })
			.expect(200);
		const resolved = await call<AlertListsResult>('get_dashboard_alerts', { id: dashboardId, include: 'resolved' });
		expect(ids(resolved.resolved)).toEqual(['mcp-recent-crit']);
		expect(resolved.resolved?.items[0].status).toBe('Resolved');
		expect(resolved.summary?.byStatus).toEqual({ Resolved: 1 });

		const all = await call<AlertListsResult>('get_dashboard_alerts', { id: dashboardId, include: 'all' });
		expect(ids(all.active)).toEqual([]);
		expect(ids(all.resolved)).toEqual(['mcp-recent-crit']);
		expect(await callError('get_dashboard_alerts', { id: dashboardId, include: 'all', cursor: 'x' })).toContain(
			'cursor'
		);
	});
});

describe('alerts', () => {
	test('search_alerts pages with a cursor chain and reports the total', async () => {
		const seen: string[] = [];
		let cursor: string | undefined;
		let pages = 0;
		do {
			const page = await call<AlertListsResult>('search_alerts', {
				filters: { 'tagKey:team': ['search'] },
				limit: 2,
				...(cursor ? { cursor } : {}),
			});
			expect(page.total).toBe(5);
			expect(page.active?.items.length).toBeLessThanOrEqual(2);
			seen.push(...ids(page.active));
			cursor = page.active?.nextCursor ?? undefined;
			pages++;
		} while (cursor);
		expect(pages).toBe(3);
		expect(seen).toEqual(['mcp-page-1', 'mcp-page-2', 'mcp-page-3', 'mcp-page-4', 'mcp-page-5']);
	});

	test('search_alerts validates filters against the live vocabulary', async () => {
		const error = await callError('search_alerts', { filters: { severity: ['Blocker'] } });
		expect(error).toContain('"Blocker"');
		expect(error).toContain('"Critical"');
		// Case is forgiven, and a window excludes by time.
		const recent = await call<AlertListsResult>('search_alerts', {
			filters: { severity: ['critical'] },
			lastMinutes: 120,
		});
		expect(ids(recent.active)).toEqual([]);
		const old = await call<AlertListsResult>('search_alerts', { filters: { severity: ['critical'] } });
		expect(ids(old.active)).toEqual(['mcp-old-crit']);
		expect(await callError('search_alerts', { lastMinutes: 5, from: ago(1) })).toContain('lastMinutes');
	});

	test('get_alert: not found names the id; found carries comments, history and root cause', async () => {
		expect(await callError('get_alert', { id: 'no-such-alert' })).toContain('no-such-alert');

		const result = await call<AlertResult>('get_alert', { id: 'mcp-recent-crit' });
		expect(result.resolved).toBe(true);
		expect(result.alert).toMatchObject({ id: 'mcp-recent-crit', alertName: 'DB down', status: 'Resolved' });
		expect(result.comments).toEqual([expect.objectContaining({ author: 'MCP Admin', comment: 'looking into it' })]);
		expect(result.history?.map((entry) => entry.eventType)).toContain('comment_added');
		expect(result.rootCause).toMatchObject({ content: 'Disk full on db-1' });

		const bare = await call<AlertResult>('get_alert', {
			id: 'mcp-old-crit',
			includeComments: false,
			includeHistory: false,
			includeRootCause: false,
		});
		expect(bare.resolved).toBe(false);
		expect(bare.comments).toBeUndefined();
		expect(bare.history).toBeUndefined();
		expect(bare.rootCause).toBeUndefined();
	});

	test('list_alert_filter_values lists live and fixed values, most common first', async () => {
		const result = await call<FilterValuesResult>('list_alert_filter_values', { include: 'active' });
		const field = (name: string) => result.fields.find((row) => row.field === name);
		expect(field('severity')?.values).toEqual(['Info', 'Critical', 'Warning']);
		expect(field('status')?.values).toEqual(['Firing', 'Muted', 'Silenced', 'Resolved']);
		expect(field('tagKey:env')?.values).toEqual(['prod']);
		expect(result.tagKeys).toEqual(['env', 'team']);
	});

	test('get_alert_analytics scopes to a dashboard', async () => {
		const result = await call<AnalyticsResult>('get_alert_analytics', {
			dashboardName: 'prod critical',
			lastMinutes: 60 * 24 * 7,
		});
		expect(result.scope.dashboard).toBe('Prod Critical');
		expect(result.byName.map((row) => row.name).sort()).toEqual(['DB down', 'Old outage']);
		expect(await callError('get_alert_analytics', { dashboardId, filters: { severity: ['Critical'] } })).toContain(
			'not both'
		);
	});
});

describe('resolveDashboardRef', () => {
	const dashboard = (id: number, name: string): Dashboard => ({
		id: String(id),
		type: 'alerts',
		name,
		filters: {},
		visibleColumns: [],
		query: '',
		groupBy: [],
	});
	const dashboards = [
		dashboard(1, 'Prod DB'),
		dashboard(2, 'Prod Web'),
		dashboard(3, 'Staging DB'),
		dashboard(4, 'prod db'),
	];

	test('an exact name wins over substrings, case-insensitively', () => {
		expect(resolveDashboardRef(dashboards, { name: 'staging db' })).toMatchObject({
			ok: true,
			dashboard: { id: '3' },
		});
	});

	test('a unique substring resolves; an ambiguous one lists the candidates', () => {
		expect(resolveDashboardRef(dashboards, { name: 'web' })).toMatchObject({ ok: true, dashboard: { id: '2' } });
		const ambiguous = resolveDashboardRef(dashboards, { name: 'prod' });
		expect(ambiguous.ok).toBe(false);
		if (ambiguous.ok) return;
		expect(ambiguous.message).toContain('"Prod DB"');
		expect(ambiguous.message).toContain('"Prod Web"');
	});

	test('two dashboards with the same name (ignoring case) need the id', () => {
		const same = resolveDashboardRef(dashboards, { name: 'PROD DB' });
		expect(same.ok).toBe(false);
		if (same.ok) return;
		expect(same.message).toContain('id 1');
		expect(same.message).toContain('id 4');
		expect(resolveDashboardRef(dashboards, { id: '4' })).toMatchObject({
			ok: true,
			dashboard: { name: 'prod db' },
		});
	});

	test('id beats name, and nothing given is an error', () => {
		expect(resolveDashboardRef(dashboards, { id: '2', name: 'Staging DB' })).toMatchObject({
			ok: true,
			dashboard: { id: '2' },
		});
		expect(resolveDashboardRef(dashboards, {})).toMatchObject({ ok: false });
		expect(resolveDashboardRef([], { name: 'x' })).toMatchObject({
			ok: false,
			message: expect.stringContaining('no dashboards'),
		});
	});
});
