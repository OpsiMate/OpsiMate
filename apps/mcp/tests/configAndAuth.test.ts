import express from 'express';
import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { DEFAULT_PATH, DEFAULT_PORT, DEFAULT_RATE_LIMIT_PER_MINUTE, readConfig } from '../src/config';
import { createRateLimit } from '../src/http/rateLimit';
import { callerKey, credentialsFromEnv, credentialsFromHeaders } from '../src/opsimate/auth';

describe('readConfig', () => {
	test('defaults, and normalisation of the URL and path', () => {
		expect(readConfig({})).toMatchObject({
			opsimateUrl: 'http://localhost:3001',
			port: DEFAULT_PORT,
			path: DEFAULT_PATH,
			rateLimitPerMinute: DEFAULT_RATE_LIMIT_PER_MINUTE,
			version: 'dev',
		});
		expect(
			readConfig({ OPSIMATE_URL: ' https://ops.example.com/ ', MCP_PATH: 'api/mcp/', MCP_PORT: '4000' })
		).toMatchObject({ opsimateUrl: 'https://ops.example.com', path: '/api/mcp', port: 4000 });
		expect(readConfig({ MCP_RATE_LIMIT_PER_MINUTE: '0' }).rateLimitPerMinute).toBe(0);
		expect(readConfig({ MCP_RATE_LIMIT_PER_MINUTE: 'lots', MCP_PORT: '-1' })).toMatchObject({
			rateLimitPerMinute: DEFAULT_RATE_LIMIT_PER_MINUTE,
			port: DEFAULT_PORT,
		});
	});
});

describe('credentials', () => {
	test('from headers: the API token wins, else a Bearer token; nothing else counts', () => {
		expect(credentialsFromHeaders({ 'x-api-token': 'abc', authorization: 'Bearer j' })).toEqual({
			header: ['x-api-token', 'abc'],
		});
		expect(credentialsFromHeaders({ authorization: 'Bearer j.w.t' })).toEqual({
			header: ['authorization', 'Bearer j.w.t'],
		});
		// The scheme is case-insensitive on the wire; OpsiMate wants it spelled "Bearer".
		expect(credentialsFromHeaders({ authorization: 'bearer j.w.t' })).toEqual({
			header: ['authorization', 'Bearer j.w.t'],
		});
		expect(credentialsFromHeaders({ authorization: 'Basic abc' })).toBeNull();
		expect(credentialsFromHeaders({ 'x-api-token': '  ' })).toBeNull();
		expect(credentialsFromHeaders({})).toBeNull();
	});

	test('from env (stdio): OPSIMATE_API_TOKEN, else OPSIMATE_TOKEN as a Bearer', () => {
		expect(credentialsFromEnv({ OPSIMATE_API_TOKEN: 'abc' })).toEqual({ header: ['x-api-token', 'abc'] });
		expect(credentialsFromEnv({ OPSIMATE_TOKEN: 'j.w.t' })).toEqual({ header: ['authorization', 'Bearer j.w.t'] });
		expect(credentialsFromEnv({ OPSIMATE_TOKEN: 'Bearer j.w.t' })).toEqual({
			header: ['authorization', 'Bearer j.w.t'],
		});
		expect(credentialsFromEnv({})).toBeNull();
	});

	test('callerKey is stable per credential and never contains it', () => {
		const a = callerKey({ header: ['x-api-token', 'secret-token'] });
		expect(a).toBe(callerKey({ header: ['x-api-token', 'secret-token'] }));
		expect(a).not.toBe(callerKey({ header: ['x-api-token', 'other'] }));
		expect(a).not.toContain('secret');
		expect(a).toHaveLength(16);
	});
});

describe('createRateLimit', () => {
	const makeApp = (maxPerWindow: number, clock: { now: number }) => {
		const app = express();
		app.use(
			createRateLimit({
				maxPerWindow,
				windowMs: 60_000,
				keyOf: (req) => req.header('x-caller') ?? null,
				now: () => clock.now,
			})
		);
		app.get('/', (_req, res) => res.json({ ok: true }));
		return app;
	};

	test('allows the limit, refuses the next with 429 and Retry-After, resets after the window', async () => {
		const clock = { now: 1_000_000 };
		const app = makeApp(2, clock);
		expect((await request(app).get('/').set('x-caller', 'a')).status).toBe(200);
		expect((await request(app).get('/').set('x-caller', 'a')).status).toBe(200);
		const refused = await request(app).get('/').set('x-caller', 'a');
		expect(refused.status).toBe(429);
		expect(refused.headers['retry-after']).toBe('60');
		// Another caller is unaffected; an unknown caller is not limited here.
		expect((await request(app).get('/').set('x-caller', 'b')).status).toBe(200);
		expect((await request(app).get('/')).status).toBe(200);
		clock.now += 60_001;
		expect((await request(app).get('/').set('x-caller', 'a')).status).toBe(200);
	});

	test('0 means no limit', async () => {
		const app = makeApp(0, { now: 1 });
		for (let i = 0; i < 20; i++) expect((await request(app).get('/').set('x-caller', 'a')).status).toBe(200);
	});
});
