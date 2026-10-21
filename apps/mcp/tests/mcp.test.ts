import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { MCP_TOOLS } from '@OpsiMate/shared';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { readConfig } from '../src/config';
import { createHttpApp } from '../src/http/app';
import { McpAlertCounts, McpAlertPage, McpAlertSummary, McpDashboardSummary } from '../src/mcp/schemas';
import { ago, API_TOKEN, FakeOpsiMate, startFakeOpsiMate, VIEWER_JWT } from './fakeOpsiMate';

// The MCP server end to end: the official client over Streamable HTTP, the MCP server on
// a real port, a fake OpsiMate behind it that runs the real query engine and records the
// credentials it was given.

// The shared list is what the Settings guide shows people; it must be exactly what is served.
const TOOL_NAMES = MCP_TOOLS.map((tool) => tool.name).sort();

interface AlertListsResult {
	include: string;
	total?: number;
	window?: { from: string | null; to: string | null };
	active?: McpAlertPage;
	resolved?: McpAlertPage;
	summary?: McpAlertCounts;
}

interface AlertResult {
	alert: McpAlertSummary;
	resolved: boolean;
	comments?: { author: string; comment: string }[];
	history?: { eventType?: string }[];
	rootCause?: { content: string } | null;
}

let opsimate: FakeOpsiMate;
let mcpServer: http.Server;
let mcpUrl: URL;
let client: Client;

const startMcp = async (env: NodeJS.ProcessEnv): Promise<{ server: http.Server; url: URL }> => {
	const app = createHttpApp(readConfig({ OPSIMATE_URL: opsimate.url, MCP_RATE_LIMIT_PER_MINUTE: '0', ...env }));
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	return { server, url: new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`) };
};

const connect = async (headers: Record<string, string>, url: URL = mcpUrl): Promise<Client> => {
	const mcpClient = new Client({ name: 'mcp-test', version: '0.0.0' });
	await mcpClient.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers } }));
	return mcpClient;
};

const call = async <T>(name: string, args: Record<string, unknown>, using: Client = client): Promise<T> => {
	const result = await using.callTool({ name, arguments: args });
	expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
	return result.structuredContent as T;
};

const callError = async (name: string, args: Record<string, unknown>, using: Client = client): Promise<string> => {
	const result = await using.callTool({ name, arguments: args });
	expect(result.isError).toBe(true);
	const [first] = result.content as Array<{ type: string; text?: string }>;
	return first?.text ?? '';
};

const ids = (page: McpAlertPage | undefined): string[] => (page?.items ?? []).map((a) => a.id);

const initialize = {
	jsonrpc: '2.0',
	id: 1,
	method: 'initialize',
	params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '0' } },
};
const rawPost = (url: URL, headers: Record<string, string>) =>
	fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
		body: JSON.stringify(initialize),
	});

beforeAll(async () => {
	opsimate = await startFakeOpsiMate();
	({ server: mcpServer, url: mcpUrl } = await startMcp({}));
	client = await connect({ 'x-api-token': API_TOKEN });
});

afterAll(async () => {
	await client.close();
	await new Promise<void>((resolve) => mcpServer.close(() => resolve()));
	await opsimate.close();
});

describe('reaching the server', () => {
	test('health says the process is up, and not where OpsiMate is (it is unauthenticated)', async () => {
		const res = await fetch(new URL('/health', mcpUrl));
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ status: 'ok', path: '/mcp' });
		expect(JSON.stringify(body)).not.toContain(opsimate.url);
	});

	test('a malformed body is a JSON-RPC parse error, not an HTML page', async () => {
		const res = await fetch(mcpUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-api-token': API_TOKEN },
			body: '{"jsonrpc":',
		});
		expect(res.status).toBe(400);
		expect(res.headers.get('content-type')).toContain('application/json');
		expect(await res.json()).toEqual({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null });
	});

	test('no credentials: 401 from the MCP server itself, OpsiMate is never called', async () => {
		const before = opsimate.seen.length;
		expect((await rawPost(mcpUrl, {})).status).toBe(401);
		// A token in the query string is not a credential.
		expect((await rawPost(new URL(`${mcpUrl.href}?api_token=${API_TOKEN}`), {})).status).toBe(401);
		expect(opsimate.seen.length).toBe(before);
	});

	test('tools/list is the seven read-only tools, each with an output schema', async () => {
		const { tools } = await client.listTools();
		expect(tools.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
		for (const info of MCP_TOOLS) {
			expect(tools.find((tool) => tool.name === info.name)?.title, info.name).toBe(info.title);
		}
		for (const tool of tools) {
			expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
			expect(tool.outputSchema, tool.name).toBeDefined();
		}
		expect(client.getInstructions()).toContain('list_dashboards');
	});

	test('GET and DELETE answer without a server error', async () => {
		const headers = { 'x-api-token': API_TOKEN, accept: 'application/json, text/event-stream' };
		expect((await fetch(mcpUrl, { method: 'GET', headers })).status).toBeLessThan(500);
		expect((await fetch(mcpUrl, { method: 'DELETE', headers })).status).toBeLessThan(500);
	});
});

describe('credentials pass through to OpsiMate', () => {
	test('the API token and a user token each reach OpsiMate as sent', async () => {
		opsimate.seen.length = 0;
		await call('list_dashboards', {});
		expect(opsimate.seen.map((r) => r.credential)).toEqual([`x-api-token: ${API_TOKEN}`]);

		const viewer = await connect({ Authorization: `Bearer ${VIEWER_JWT}` });
		try {
			opsimate.seen.length = 0;
			await call('list_dashboards', {}, viewer);
			expect(opsimate.seen.map((r) => r.credential)).toEqual([`authorization: Bearer ${VIEWER_JWT}`]);
		} finally {
			await viewer.close();
		}
	});

	test('a credential OpsiMate refuses becomes a tool error that says so', async () => {
		const stranger = await connect({ 'x-api-token': 'not-the-token' });
		try {
			const error = await callError('list_dashboards', {}, stranger);
			expect(error).toContain('401');
			expect(error).toContain('refused the credentials');
		} finally {
			await stranger.close();
		}
	});
});

describe('dashboards', () => {
	test('list, and get by exact / case-insensitive / partial name', async () => {
		const { dashboards } = await call<{ dashboards: McpDashboardSummary[] }>('list_dashboards', {});
		expect(dashboards.map((d) => d.name)).toEqual(['Prod Critical', 'Platform warnings']);
		expect(dashboards[0]).toMatchObject({ filters: { severity: ['Critical'], 'tagKey:env': ['prod'] } });
		expect(dashboards[0]).not.toHaveProperty('visibleColumns');

		const byName = await call<{ dashboard: McpDashboardSummary; description: string }>('get_dashboard', {
			name: 'prod critical',
		});
		expect(byName.dashboard.id).toBe('1');
		expect(byName.description).toContain('last 24 hours');
		expect(
			(await call<{ dashboard: McpDashboardSummary }>('get_dashboard', { name: 'WARNINGS' })).dashboard.id
		).toBe('2');
		expect(await callError('get_dashboard', { name: 'nope' })).toContain('"Prod Critical"');
		expect(await callError('get_dashboard', { id: '999' })).toContain('999');
	});

	test('get_dashboard_alerts applies the filters and the rolling window, with a summary', async () => {
		const result = await call<AlertListsResult>('get_dashboard_alerts', { name: 'Prod Critical' });
		// old-crit (48h) falls outside last24h; recent-warn fails the severity filter.
		expect(ids(result.active)).toEqual(['recent-crit']);
		expect(result.summary).toEqual({ total: 1, bySeverity: { Critical: 1 }, byStatus: { Firing: 1 } });
		expect(result.active?.items[0]).toMatchObject({ severity: 'Critical', status: 'Firing', owner: 'Dana Levi' });
		// The severity mirror tag is hidden; the owner id is a name.
		expect(result.active?.items[0].tags).toEqual({ env: 'prod' });
		expect(result.active?.items[0]).not.toHaveProperty('ownerId');

		const all = await call<AlertListsResult>('get_dashboard_alerts', { id: '1', include: 'all' });
		expect(ids(all.active)).toEqual(['recent-crit']);
		expect(ids(all.resolved)).toEqual(['resolved-crit']);
		expect(all.summary?.byStatus).toEqual({ Firing: 1, Resolved: 1 });
		expect(await callError('get_dashboard_alerts', { id: '1', include: 'all', cursor: 'x' })).toContain('cursor');
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
			seen.push(...ids(page.active));
			cursor = page.active?.nextCursor ?? undefined;
			pages++;
		} while (cursor);
		expect(pages).toBe(3);
		expect(seen).toEqual(['page-1', 'page-2', 'page-3', 'page-4', 'page-5']);
	});

	test('search_alerts validates filters against the live vocabulary and applies windows', async () => {
		const error = await callError('search_alerts', { filters: { severity: ['Blocker'] } });
		expect(error).toContain('"Blocker"');
		expect(error).toContain('"Critical"');
		const recent = await call<AlertListsResult>('search_alerts', {
			filters: { severity: ['critical'] },
			lastMinutes: 120,
		});
		expect(ids(recent.active)).toEqual(['recent-crit']);
		const window = await call<AlertListsResult>('search_alerts', { from: ago(72), to: ago(24) });
		expect(ids(window.active)).toEqual(['old-crit']);
		expect(await callError('search_alerts', { lastMinutes: 5, from: ago(1) })).toContain('lastMinutes');
	});

	test('get_alert: found carries comments, history and root cause; not found names the id', async () => {
		const result = await call<AlertResult>('get_alert', { id: 'recent-crit' });
		expect(result.resolved).toBe(false);
		expect(result.alert).toMatchObject({ alertName: 'DB down', status: 'Firing', owner: 'Dana Levi' });
		expect(result.comments).toEqual([expect.objectContaining({ author: 'Dana Levi', comment: 'looking into it' })]);
		expect(result.history?.map((h) => h.eventType)).toContain('comment_added');
		expect(result.rootCause).toMatchObject({ content: 'Disk full on db-1' });

		const resolved = await call<AlertResult>('get_alert', { id: 'resolved-crit', includeHistory: false });
		expect(resolved.resolved).toBe(true);
		expect(resolved.alert.status).toBe('Resolved');
		expect(resolved.rootCause).toBeNull();
		expect(await callError('get_alert', { id: 'no-such-alert' })).toContain('no-such-alert');
	});

	test('list_alert_filter_values lists live and fixed values', async () => {
		const result = await call<{ fields: { field: string; values: string[] }[]; tagKeys: string[] }>(
			'list_alert_filter_values',
			{ include: 'active' }
		);
		const field = (name: string) => result.fields.find((row) => row.field === name);
		expect(field('status')?.values).toEqual(['Firing', 'Silenced', 'Muted', 'Resolved']);
		expect(field('owner')?.values).toContain('Dana Levi');
		expect(result.tagKeys).toEqual(['env', 'team']);
	});

	test('get_alert_analytics scopes to a dashboard and sends the window and zone to OpsiMate', async () => {
		opsimate.seen.length = 0;
		const result = await call<{ scope: { dashboard?: string }; range: { from: string | null } }>(
			'get_alert_analytics',
			{ dashboardName: 'prod critical', timeZone: 'Asia/Jerusalem' }
		);
		expect(result.scope.dashboard).toBe('Prod Critical');
		const analytics = opsimate.seen.find((r) => r.path === '/api/v1/alerts/analytics');
		expect(analytics?.query).toMatchObject({ tz: 'Asia/Jerusalem' });
		expect(JSON.parse(analytics?.query.filters ?? '{}')).toEqual({
			severity: ['Critical'],
			'tagKey:env': ['prod'],
		});
		expect(analytics?.query.from).toBeTruthy();
		expect(result.range.from).toBe(analytics?.query.from);
		expect(
			await callError('get_alert_analytics', { dashboardId: '1', filters: { severity: ['Critical'] } })
		).toContain('not both');
	});
});

describe('rate limit', () => {
	test('MCP_RATE_LIMIT_PER_MINUTE counts per caller; OpsiMate is not asked for a refused request', async () => {
		const limited = await startMcp({ MCP_RATE_LIMIT_PER_MINUTE: '2' });
		try {
			const headers = { 'x-api-token': API_TOKEN };
			expect((await rawPost(limited.url, headers)).status).toBe(200);
			expect((await rawPost(limited.url, headers)).status).toBe(200);
			const refused = await rawPost(limited.url, headers);
			expect(refused.status).toBe(429);
			expect(refused.headers.get('retry-after')).toBe('60');
			// Another caller's bucket is separate; no credentials is still a 401.
			expect((await rawPost(limited.url, { Authorization: `Bearer ${VIEWER_JWT}` })).status).toBe(200);
			expect((await rawPost(limited.url, {})).status).toBe(401);
		} finally {
			await new Promise<void>((resolve) => limited.server.close(() => resolve()));
		}
	});
});
