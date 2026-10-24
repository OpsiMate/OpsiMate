import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createHttpApp, readConfig } from '@OpsiMate/mcp';
import Database from 'better-sqlite3';
import express from 'express';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { AppMode, createApp } from '../src/app';
import { getSecurityConfig } from '../src/config/config';
import { setupDB } from './setup';

// The MCP server (apps/mcp) against a REAL OpsiMate: both on real ports, the MCP server
// pointed at OpsiMate's URL, driven by the official MCP client. Data is seeded through
// the REST API the way an installation's is. The MCP package's own tests cover the tools
// in depth against a fake; this proves the two actually fit together: auth pass-through,
// the owners endpoint, time windows resolved against live data.

interface AlertPage {
	items: { id: string; owner: string; status: string }[];
	total: number;
}

interface AlertListsResult {
	active?: AlertPage;
	resolved?: AlertPage;
	summary?: { total: number; byStatus: Record<string, number> };
}

interface AlertResult {
	alert: { owner: string };
	comments?: { author: string; comment: string }[];
}

const HOUR_MS = 60 * 60 * 1000;
const ago = (hours: number): string => new Date(Date.now() - hours * HOUR_MS).toISOString();

let db: Database.Database;
let opsimate: http.Server;
let mcp: http.Server;
let mcpUrl: URL;
let apiToken: string;
let viewerJwt: string;

const listen = async (app: express.Application): Promise<http.Server> => {
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	return server;
};
const urlOf = (server: http.Server): string => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const connect = async (headers: Record<string, string>): Promise<Client> => {
	const client = new Client({ name: 'mcp-container-test', version: '0.0.0' });
	await client.connect(new StreamableHTTPClientTransport(mcpUrl, { requestInit: { headers } }));
	return client;
};

const call = async <T>(client: Client, name: string, args: Record<string, unknown>): Promise<T> => {
	const result = await client.callTool({ name, arguments: args });
	expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
	return result.structuredContent as T;
};

beforeAll(async () => {
	db = await setupDB();
	const app = await createApp(db, AppMode.SERVER);
	if (!app) throw new Error('createApp returned no app');
	opsimate = await listen(app);
	apiToken = getSecurityConfig().api_token;

	const api = request(app);
	await api
		.post('/api/v1/users/register')
		.send({ email: 'mcp-admin@example.com', fullName: 'MCP Admin', password: 'password123' });
	const adminJwt = (
		await api.post('/api/v1/users/login').send({ email: 'mcp-admin@example.com', password: 'password123' })
	).body.token as string;
	await api
		.post('/api/v1/users')
		.set('Authorization', `Bearer ${adminJwt}`)
		.send({ email: 'mcp-viewer@example.com', fullName: 'MCP Viewer', password: 'password123', role: 'viewer' });
	viewerJwt = (
		await api.post('/api/v1/users/login').send({ email: 'mcp-viewer@example.com', password: 'password123' })
	).body.token as string;

	const fire = (body: Record<string, unknown>) =>
		api.post('/api/v1/alerts/custom').set('x-api-token', apiToken).send(body).expect(200);
	await fire({
		id: 'mcp-recent',
		alertName: 'DB down',
		severity: 'critical',
		tags: { env: 'prod' },
		startsAt: ago(1),
	});
	await fire({
		id: 'mcp-old',
		alertName: 'Old outage',
		severity: 'critical',
		tags: { env: 'prod' },
		startsAt: ago(48),
		updatedAt: ago(48),
	});
	await api
		.post('/api/v1/alerts/mcp-recent/comments')
		.set('Authorization', `Bearer ${adminJwt}`)
		.send({ comment: 'on it' })
		.expect(201);
	await api
		.patch('/api/v1/alerts/mcp-recent/owner')
		.set('Authorization', `Bearer ${adminJwt}`)
		.send({ ownerId: '1' });
	await api
		.post('/api/v1/dashboards')
		.set('Authorization', `Bearer ${adminJwt}`)
		.send({
			name: 'Prod Critical',
			type: 'alerts',
			filters: { severity: ['Critical'] },
			visibleColumns: ['alertName'],
			query: '',
			groupBy: [],
			timeRange: { from: null, to: null, preset: 'last24h' },
		})
		.expect(200);

	mcp = await listen(createHttpApp(readConfig({ OPSIMATE_URL: urlOf(opsimate), MCP_RATE_LIMIT_PER_MINUTE: '0' })));
	mcpUrl = new URL(`${urlOf(mcp)}/mcp`);
});

afterAll(async () => {
	await new Promise<void>((resolve) => mcp.close(() => resolve()));
	await new Promise<void>((resolve) => opsimate.close(() => resolve()));
	db.close();
});

describe('MCP server against a real OpsiMate', () => {
	test('a Viewer login token passes through: the dashboard window excludes the old alert, names come from /alerts/owners', async () => {
		const viewer = await connect({ Authorization: `Bearer ${viewerJwt}` });
		try {
			const result = await call<AlertListsResult>(viewer, 'get_dashboard_alerts', { name: 'Prod Critical' });
			expect(result.active?.items.map((a) => a.id)).toEqual(['mcp-recent']);
			expect(result.active?.items[0].owner).toBe('MCP Admin');
			expect(result.summary).toMatchObject({ total: 1, byStatus: { Firing: 1 } });
		} finally {
			await viewer.close();
		}
	});

	test('the API token works too, and get_alert carries the comment with its author', async () => {
		const client = await connect({ 'x-api-token': apiToken });
		try {
			const result = await call<AlertResult>(client, 'get_alert', { id: 'mcp-recent' });
			expect(result.alert.owner).toBe('MCP Admin');
			expect(result.comments).toEqual([expect.objectContaining({ author: 'MCP Admin', comment: 'on it' })]);
		} finally {
			await client.close();
		}
	});

	test('a credential OpsiMate rejects is a tool error naming the 401; none at all is refused by the MCP server', async () => {
		const stranger = await connect({ 'x-api-token': 'wrong-token' });
		try {
			const result = await stranger.callTool({ name: 'list_dashboards', arguments: {} });
			expect(result.isError).toBe(true);
			expect(JSON.stringify(result.content)).toContain('401');
		} finally {
			await stranger.close();
		}
		const res = await fetch(mcpUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
		});
		expect(res.status).toBe(401);
	});
});
