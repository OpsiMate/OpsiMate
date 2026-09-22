import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

// Regression coverage for the hardcoded 'opsimate' API-token default. Every layer
// that used to fall back to it (config.ts, default-config.yml, docker-compose.yml)
// shipped the same literal, so anyone could authenticate to a fresh install with
// no configuration at all. Isolated from the rest of the suite (no ./setup import)
// so it controls config.ts's env-derived, module-cached default directly, instead
// of the value every other test file's eager `secrets/router.ts` import already froze.
describe('API-token default when no API_TOKEN is configured', () => {
	const originalToken = process.env.API_TOKEN;

	beforeEach(() => {
		delete process.env.API_TOKEN;
		vi.resetModules();
	});

	afterEach(() => {
		if (originalToken === undefined) {
			delete process.env.API_TOKEN;
		} else {
			process.env.API_TOKEN = originalToken;
		}
		vi.resetModules();
	});

	async function buildApp(): Promise<Express> {
		const { authenticateJWT } = await import('../src/middleware/auth.ts');
		const app = express();
		app.get('/protected', authenticateJWT, (_req, res) => res.status(200).json({ success: true }));
		return app;
	}

	test('the old hardcoded default token no longer authenticates', async () => {
		const app = await buildApp();
		const res = await request(app).get('/protected').set('x-api-token', 'opsimate');
		expect(res.status).toBe(401);
		expect(res.body).toEqual({ success: false, error: 'Invalid API token' });
	});

	test('no token value authenticates when none is configured', async () => {
		const app = await buildApp();
		for (const candidate of ['opsimate', '', 'undefined', 'null']) {
			const res = await request(app).get('/protected').set('x-api-token', candidate);
			expect(res.status, `candidate ${JSON.stringify(candidate)}`).toBe(401);
		}
	});

	test('a request with no credentials at all is still rejected the same way', async () => {
		const app = await buildApp();
		const res = await request(app).get('/protected');
		expect(res.status).toBe(401);
	});
});

describe('API-token auth once an operator sets a real token', () => {
	const originalToken = process.env.API_TOKEN;

	beforeEach(() => {
		process.env.API_TOKEN = 'a-real-operator-chosen-token';
		vi.resetModules();
	});

	afterEach(() => {
		if (originalToken === undefined) {
			delete process.env.API_TOKEN;
		} else {
			process.env.API_TOKEN = originalToken;
		}
		vi.resetModules();
	});

	test('the configured token authenticates', async () => {
		const { authenticateJWT } = await import('../src/middleware/auth.ts');
		const app = express();
		app.get('/protected', authenticateJWT, (_req, res) => res.status(200).json({ success: true }));

		const res = await request(app).get('/protected').set('x-api-token', 'a-real-operator-chosen-token');
		expect(res.status).toBe(200);
	});

	test('the old hardcoded default is not treated as a fallback match', async () => {
		const { authenticateJWT } = await import('../src/middleware/auth.ts');
		const app = express();
		app.get('/protected', authenticateJWT, (_req, res) => res.status(200).json({ success: true }));

		const res = await request(app).get('/protected').set('x-api-token', 'opsimate');
		expect(res.status).toBe(401);
	});
});
