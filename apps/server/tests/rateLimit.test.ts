import { Role, User } from '@OpsiMate/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { AuthenticatedRequest } from '../src/middleware/auth';
import { createRateLimit } from '../src/middleware/rateLimit';

// A tiny app: an "auth" step that reads the caller from headers the way the real guards
// would set req.user, then the limiter, then a 200.
const makeApp = (maxPerWindow: number, clock: { now: number }) => {
	const app = express();
	app.use((req, _res, next) => {
		const userId = req.header('x-test-user');
		if (userId) {
			(req as AuthenticatedRequest).user = {
				id: userId,
				email: `${userId}@example.com`,
				fullName: `User ${userId}`,
				role: Role.Viewer,
			} as User;
		}
		next();
	});
	app.use(createRateLimit({ maxPerWindow, windowMs: 60_000, now: () => clock.now }));
	app.get('/', (_req, res) => res.json({ ok: true }));
	return app;
};

describe('createRateLimit', () => {
	test('allows the limit, refuses the next with 429 and Retry-After, and resets after the window', async () => {
		const clock = { now: 1_000_000 };
		const app = makeApp(3, clock);
		for (let i = 0; i < 3; i++) expect((await request(app).get('/').set('x-test-user', '7')).status).toBe(200);
		const refused = await request(app).get('/').set('x-test-user', '7');
		expect(refused.status).toBe(429);
		expect(refused.headers['retry-after']).toBe('60');
		expect(refused.body.error).toMatch(/3 requests per 60s/);

		clock.now += 60_001;
		expect((await request(app).get('/').set('x-test-user', '7')).status).toBe(200);
	});

	test('counts per caller: another user, the API token and an anonymous address are separate', async () => {
		const clock = { now: 1_000_000 };
		const app = makeApp(1, clock);
		expect((await request(app).get('/').set('x-test-user', '7')).status).toBe(200);
		expect((await request(app).get('/').set('x-test-user', '7')).status).toBe(429);
		expect((await request(app).get('/').set('x-test-user', '8')).status).toBe(200);
		expect((await request(app).get('/').set('x-api-token', 'abc')).status).toBe(200);
		expect((await request(app).get('/').set('x-api-token', 'abc')).status).toBe(429);
		expect((await request(app).get('/')).status).toBe(200);
	});

	test('0 means no limit', async () => {
		const app = makeApp(0, { now: 1 });
		for (let i = 0; i < 50; i++) expect((await request(app).get('/').set('x-test-user', '7')).status).toBe(200);
	});
});
