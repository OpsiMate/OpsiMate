import Database from 'better-sqlite3';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { API_ROUTE_DOCS, buildOpenApiDocument } from '../src/api/openapi/document';
import { PENDING_API_ROUTES } from '../src/api/openapi/pendingRoutes';
import { apiDocsEnabled } from '../src/api/openapi/serve';
import { AppMode, createApp } from '../src/app';
import { getSecurityConfig } from '../src/config/config';
import { RecordedRoute, startRecordingRoutes } from './helpers/recordRoutes';
import { setupDB } from './setup';

interface OpenApiOperation {
	operationId: string;
	parameters?: OpenApiParameter[];
}

interface OpenApiParameter {
	name: string;
	in: string;
}

const key = (route: RecordedRoute): string => `${route.method.toUpperCase()} ${route.path}`;
const isDocsPage = (path: string): boolean => path === '/api/openapi.json' || path.startsWith('/api/docs');

let db: Database.Database;
let app: Awaited<ReturnType<typeof createApp>>;
let appRoutes: RecordedRoute[];

beforeAll(async () => {
	db = await setupDB();
	const recorder = startRecordingRoutes();
	try {
		app = await createApp(db, AppMode.SERVER);
	} finally {
		recorder.stop();
	}
	if (!app) throw new Error('createApp returned no app');
	appRoutes = recorder.routesOf(app).filter((route) => route.path.startsWith('/api/') && !isDocsPage(route.path));
});

afterAll(() => db.close());

describe('API reference coverage', () => {
	test('every API route is documented, or listed as not documented yet', () => {
		const known = new Set([...API_ROUTE_DOCS, ...PENDING_API_ROUTES].map(key));
		const missing = appRoutes.map(key).filter((route) => !known.has(route));
		// A new endpoint: describe it in src/api/openapi/routes/*.ts (or, for now, list it in pendingRoutes.ts).
		expect(missing).toEqual([]);
	});

	test('every documented route really exists (no typos, no removed routes)', () => {
		const real = new Set(appRoutes.map(key));
		expect(API_ROUTE_DOCS.map(key).filter((route) => !real.has(route))).toEqual([]);
	});

	test('the not-yet-documented list stays honest', () => {
		const real = new Set(appRoutes.map(key));
		const documented = new Set(API_ROUTE_DOCS.map(key));
		const pending = PENDING_API_ROUTES.map(key);
		expect(pending.filter((route) => !real.has(route))).toEqual([]); // removed from the app
		expect(pending.filter((route) => documented.has(route))).toEqual([]); // documented: drop it from the list
		expect(new Set(pending).size).toBe(pending.length);
	});

	test('the first batch covers sign-in, every webhook and the core alert routes', () => {
		const documented = new Set(API_ROUTE_DOCS.map(key));
		for (const route of [
			'POST /api/v1/users/login',
			'POST /api/v1/alerts/custom',
			'POST /api/v1/alerts/custom/grafana',
			'POST /api/v1/alerts/custom/datadog',
			'POST /api/v1/alerts/custom/gcp',
			'POST /api/v1/alerts/custom/uptimekuma',
			'POST /api/v1/alerts/custom/zabbix',
			'GET /api/v1/alerts',
			'DELETE /api/v1/alerts/:alertId',
		]) {
			expect(documented.has(route), route).toBe(true);
		}
	});
});

describe('OpenAPI document', () => {
	const doc = buildOpenApiDocument({ version: '1.2.3' });
	const operations = Object.entries(doc.paths).flatMap(([path, methods]) =>
		Object.values(methods).map((operation) => ({ path, operation: operation as OpenApiOperation }))
	);

	test('is OpenAPI 3.1 with both ways to authenticate', () => {
		expect(doc.openapi).toBe('3.1.0');
		expect(doc.info.version).toBe('1.2.3');
		expect(Object.keys(doc.components.securitySchemes)).toEqual(['apiToken', 'bearerAuth']);
	});

	test('every $ref points at a schema that exists', () => {
		const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map((m) => m[1]);
		expect(refs.length).toBeGreaterThan(0);
		expect(refs.filter((ref) => !(ref in doc.components.schemas))).toEqual([]);
		expect(JSON.stringify(doc)).not.toContain('#/$defs/');
	});

	test('every component is a real definition, never a reference to itself', () => {
		for (const [id, schema] of Object.entries(doc.components.schemas)) {
			expect(JSON.stringify(schema), id).not.toBe(JSON.stringify({ $ref: `#/components/schemas/${id}` }));
			expect(schema, id).not.toHaveProperty('$ref');
		}
	});

	test('operation ids are unique', () => {
		const ids = operations.map(({ operation }) => operation.operationId);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test('every {param} in a path is declared as a path parameter', () => {
		for (const { path, operation } of operations) {
			const declared = (operation.parameters ?? []).filter((p) => p.in === 'path').map((p) => p.name);
			const inPath = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
			expect(declared.sort(), path).toEqual(inPath.sort());
		}
	});
});

describe('serving the docs', () => {
	test('the document and the page need no sign-in', async () => {
		const spec = await request(app!).get('/api/openapi.json');
		expect(spec.status).toBe(200);
		expect(spec.body.info.title).toBe('OpsiMate API');

		expect((await request(app!).get('/api/docs')).headers.location).toBe('/api/docs/');
		const page = await request(app!).get('/api/docs/');
		expect(page.status).toBe(200);
		expect(page.text).toContain('SwaggerUIBundle');

		const bundle = await request(app!).get('/api/docs/assets/swagger-ui-bundle.js');
		expect(bundle.status).toBe(200);
		expect(bundle.headers['content-type']).toContain('javascript');
	});

	test('API_DOCS_ENABLED=false turns them off', async () => {
		expect(apiDocsEnabled({})).toBe(true);
		expect(apiDocsEnabled({ API_DOCS_ENABLED: 'true' })).toBe(true);
		expect(apiDocsEnabled({ API_DOCS_ENABLED: 'False' })).toBe(false);

		// And through a real app: nothing is served.
		const saved = process.env.API_DOCS_ENABLED;
		process.env.API_DOCS_ENABLED = 'false';
		const offDb = await setupDB();
		try {
			const offApp = await createApp(offDb, AppMode.SERVER);
			if (!offApp) throw new Error('createApp returned no app');
			expect((await request(offApp).get('/api/openapi.json')).status).toBe(404);
			expect((await request(offApp).get('/api/docs/')).status).toBe(404);
			expect((await request(offApp).get('/api/docs/assets/swagger-ui-bundle.js')).status).toBe(404);
		} finally {
			if (saved === undefined) delete process.env.API_DOCS_ENABLED;
			else process.env.API_DOCS_ENABLED = saved;
			offDb.close();
		}
	});

	test('the page does not keep the token after the tab closes', async () => {
		const page = await request(app!).get('/api/docs/');
		expect(page.text).toContain('persistAuthorization: false');
	});
});

// The documented response shapes are checked against what the API really answers, so the
// docs can't drift from the handlers either.
describe('documented responses match the real API', () => {
	const responseSchema = (method: string, path: string, status: number) => {
		const route = API_ROUTE_DOCS.find((doc) => doc.method === method && doc.path === path);
		const schema = route?.responses[status]?.schema;
		if (!schema) throw new Error(`No documented ${status} response for ${method.toUpperCase()} ${path}`);
		return schema;
	};
	const expectDocumented = (method: string, path: string, res: request.Response): void => {
		const parsed = responseSchema(method, path, res.status).safeParse(res.body);
		expect(parsed.success ? [] : parsed.error.issues, `${method.toUpperCase()} ${path} → ${res.status}`).toEqual(
			[]
		);
	};

	test('sign-in, webhooks, alert list, silence, comments and resolve', async () => {
		const api = request(app!);
		const token = getSecurityConfig().api_token;

		const registered = await api
			.post('/api/v1/users/register')
			.send({ email: 'docs@example.com', fullName: 'Docs Admin', password: 'password123' });
		expectDocumented('post', '/api/v1/users/register', registered);
		const login = await api
			.post('/api/v1/users/login')
			.send({ email: 'docs@example.com', password: 'password123' });
		expectDocumented('post', '/api/v1/users/login', login);
		const jwt = `Bearer ${login.body.token}`;

		const fired = await api
			.post('/api/v1/alerts/custom')
			.set('x-api-token', token)
			.send({ id: 'docs-1', alertName: 'Docs alert', tags: { env: 'test' }, severity: 'critical' });
		expectDocumented('post', '/api/v1/alerts/custom', fired);

		expectDocumented('get', '/api/v1/alerts', await api.get('/api/v1/alerts').set('x-api-token', token));
		expectDocumented('get', '/api/v1/alerts', await api.get('/api/v1/alerts?limit=5').set('x-api-token', token));

		const silenced = await api.patch('/api/v1/alerts/docs-1/silence').set('Authorization', jwt).send({});
		expectDocumented('patch', '/api/v1/alerts/:id/silence', silenced);

		const comment = await api
			.post('/api/v1/alerts/docs-1/comments')
			.set('Authorization', jwt)
			.send({ comment: 'looking into it' });
		expectDocumented('post', '/api/v1/alerts/:alertId/comments', comment);
		expectDocumented(
			'get',
			'/api/v1/alerts/:alertId/comments',
			await api.get('/api/v1/alerts/docs-1/comments').set('Authorization', jwt)
		);

		const resolved = await api
			.post('/api/v1/alerts/custom')
			.set('x-api-token', token)
			.send({ id: 'docs-1', status: 'resolved' });
		expectDocumented('post', '/api/v1/alerts/custom', resolved);
		expect(resolved.body.data).toMatchObject({ status: 'resolved' });
		expectDocumented(
			'get',
			'/api/v1/alerts/resolved',
			await api.get('/api/v1/alerts/resolved').set('x-api-token', token)
		);

		const exists = await api.get('/api/v1/users/exists');
		expectDocumented('get', '/api/v1/users/exists', exists);
	});

	test('integrations, and credentials never come back', async () => {
		const api = request(app!);
		const token = getSecurityConfig().api_token;
		const created = await api
			.post('/api/v1/integrations')
			.set('x-api-token', token)
			.send({
				name: 'Docs Datadog',
				type: 'Datadog',
				externalUrl: 'https://app.datadoghq.com',
				credentials: { apiKey: 'secret-api-key', appKey: 'secret-app-key' },
			});
		expectDocumented('post', '/api/v1/integrations', created);
		const list = await api.get('/api/v1/integrations').set('x-api-token', token);
		expectDocumented('get', '/api/v1/integrations', list);
		for (const body of [created.body, list.body]) {
			expect(JSON.stringify(body)).not.toContain('secret-api-key');
			expect(JSON.stringify(body)).not.toContain('credentials');
		}
	});
});
