import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// Covers the shared `requireAdmin` middleware (src/middleware/auth.ts) now that the
// gate lives in the routers instead of being re-implemented in five controllers.
// The point of these tests is the *layering*: `authenticateJWT` must still run first
// (401 before 403, and the viewer write-block before the admin check), API-token
// callers must still be rejected, and the routes that were deliberately left open
// must stay open.

let app: SuperTest<Test>;
let db: Database.Database;
let adminToken: string;
let editorToken: string;
let viewerToken: string;
let operationToken: string;

// Every route the middleware now guards, one per router-level decision.
const ADMIN_ROUTES = [
	['get', '/api/v1/alerts/silence-reset'],
	['put', '/api/v1/alerts/silence-reset'],
	['get', '/api/v1/retention'],
	['put', '/api/v1/retention/config'],
	['post', '/api/v1/retention/run'],
	['put', '/api/v1/retention/policies/alerts'],
	['post', '/api/v1/oncall/teams'],
	['patch', '/api/v1/oncall/teams/1'],
	['delete', '/api/v1/oncall/teams/1'],
	['put', '/api/v1/oncall/teams/1/members'],
	['get', '/api/v1/ai/config'],
	['put', '/api/v1/ai/config'],
	['post', '/api/v1/ai/test'],
	['post', '/api/v1/users'],
	['patch', '/api/v1/users/role'],
	['delete', '/api/v1/users/999'],
	['patch', '/api/v1/users/999/reset-password'],
	['patch', '/api/v1/users/999'],
] as const;

const send = (method: string, path: string) => (app as unknown as Record<string, (p: string) => Test>)[method](path);

const createUserWithRole = async (role: string): Promise<string> => {
	const email = `${role}@requireadmin.test`;
	const password = 'password123';
	await app
		.post('/api/v1/users')
		.set('Authorization', `Bearer ${adminToken}`)
		.send({ email, fullName: `${role} user`, password, role });
	const login = await app.post('/api/v1/users/login').send({ email, password });
	expect(login.body.token).toBeTruthy();
	return login.body.token as string;
};

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	// The first registered user is auto-promoted to admin.
	adminToken = await setupUserWithToken(app);
	editorToken = await createUserWithRole('editor');
	viewerToken = await createUserWithRole('viewer');
	operationToken = await createUserWithRole('operation');
});

afterAll(() => {
	db.close();
});

describe('requireAdmin middleware', () => {
	test('unauthenticated requests are rejected by authenticateJWT, before the admin gate', async () => {
		for (const [method, path] of ADMIN_ROUTES) {
			const res = await send(method, path);
			expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
			expect(res.body.error, `${method.toUpperCase()} ${path}`).toBe('Missing Authorization header or API token');
		}
	});

	// Editors are the only non-admin role that reaches requireAdmin on write methods
	// (viewers are stopped earlier), so this is the strongest probe of the gate itself.
	test('editors get 403 Forbidden: Admins only on every gated route', async () => {
		for (const [method, path] of ADMIN_ROUTES) {
			const res = await send(method, path).set('Authorization', `Bearer ${editorToken}`);
			expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
			expect(res.body).toEqual({ success: false, error: 'Forbidden: Admins only' });
		}
	});

	test('the operation role is not treated as admin', async () => {
		for (const [method, path] of ADMIN_ROUTES) {
			const res = await send(method, path).set('Authorization', `Bearer ${operationToken}`);
			expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
			expect(res.body).toEqual({ success: false, error: 'Forbidden: Admins only' });
		}
	});

	// Layering assertion: the viewer write-block lives in authenticateJWT and must
	// still fire *before* requireAdmin, so the two roles get different messages.
	test('viewers hit the write-block on writes and the admin gate on reads', async () => {
		for (const [method, path] of ADMIN_ROUTES) {
			const res = await send(method, path).set('Authorization', `Bearer ${viewerToken}`);
			expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
			expect(res.body.error, `${method.toUpperCase()} ${path}`).toBe(
				method === 'get' ? 'Forbidden: Admins only' : 'Forbidden: Viewer users cannot edit data'
			);
		}
	});

	// API-token auth calls next() without populating req.user, so the `!req.user`
	// clause in requireAdmin is what keeps these endpoints human-admin only.
	test('API-token callers are rejected (they carry no user identity)', async () => {
		for (const [method, path] of ADMIN_ROUTES) {
			const res = await send(method, path).set('x-api-token', process.env.API_TOKEN ?? 'opsimate');
			expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
			expect(res.body).toEqual({ success: false, error: 'Forbidden: Admins only' });
		}
	});

	// Not pinned to 200: several of these legitimately 400/404 on placeholder ids and
	// empty bodies. What matters is that the gate itself lets admins through.
	test('admins are never blocked by the gate', async () => {
		for (const [method, path] of ADMIN_ROUTES) {
			const res = await send(method, path).set('Authorization', `Bearer ${adminToken}`);
			expect(res.status, `${method.toUpperCase()} ${path}`).not.toBe(403);
		}
	});
});

describe('routes deliberately left open to non-admins', () => {
	const OPEN_ROUTES = [
		'/api/v1/oncall/teams',
		'/api/v1/ai/status',
		'/api/v1/users',
		'/api/v1/users/profile',
		'/api/v1/alerts',
	];

	test('every authenticated role can still read them', async () => {
		for (const token of [editorToken, viewerToken, operationToken]) {
			for (const path of OPEN_ROUTES) {
				const res = await app.get(path).set('Authorization', `Bearer ${token}`);
				expect(res.status, path).toBe(200);
			}
		}
	});

	// GET /users feeds the alerts UI (owner pickers, comment authors, grouping and
	// sorting) for every role — gating it would be a silent client regression.
	test('GET /users stays ungated', async () => {
		const res = await app.get('/api/v1/users').set('Authorization', `Bearer ${viewerToken}`);
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body.data)).toBe(true);
	});
});

// A router-level `router.use(requireAdmin)` on any of the mixed routers would break
// one of these; they lock the per-route application in place.
describe('route ordering is unaffected by the added middleware', () => {
	test('the alerts silence-reset gate does not leak onto /:alertId', async () => {
		const res = await app.delete('/api/v1/alerts/some-id').set('Authorization', `Bearer ${editorToken}`);
		expect(res.body.error).not.toBe('Forbidden: Admins only');
	});

	test('PATCH /users/profile still matches before the gated /:id', async () => {
		const res = await app
			.patch('/api/v1/users/profile')
			.set('Authorization', `Bearer ${editorToken}`)
			.send({ fullName: 'Renamed Editor' });
		expect(res.status).toBe(200);
	});

	test('PATCH /users/role is gated and still matches before /:id', async () => {
		const res = await app.patch('/api/v1/users/role').set('Authorization', `Bearer ${editorToken}`);
		expect(res.status).toBe(403);
		expect(res.body.error).toBe('Forbidden: Admins only');
	});

	test('POST /ai/filter stayed open', async () => {
		const res = await app.post('/api/v1/ai/filter').set('Authorization', `Bearer ${editorToken}`);
		expect(res.status).not.toBe(403);
	});
});
