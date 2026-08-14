import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// The AI (BYOK/Bedrock) configuration endpoints: admin gating, key masking and
// lifecycle (set/keep/delete), and the Test Connection round trip against a local mock
// of the Bedrock Converse API (success, auth failure, and bad-model responses).

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

// Local stand-in for bedrock-runtime: replies like Converse, and switches behavior on
// the bearer token so each outcome is testable.
let bedrockMock: http.Server;
let receivedAuth: string | null = null;
let receivedPath: string | null = null;

const startBedrockMock = (): Promise<string> =>
	new Promise((resolve) => {
		bedrockMock = http.createServer((req, res) => {
			receivedAuth = req.headers.authorization ?? null;
			receivedPath = req.url ?? null;
			let body = '';
			req.on('data', (c) => (body += c));
			req.on('end', () => {
				if (receivedAuth === 'Bearer good-key') {
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ output: { message: { content: [{ text: 'ok' }] } } }));
				} else if (receivedAuth === 'Bearer bad-model-key') {
					res.writeHead(400, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ message: 'The provided model identifier is invalid.' }));
				} else {
					res.writeHead(403, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ message: 'The security token included in the request is invalid.' }));
				}
			});
		});
		bedrockMock.listen(0, '127.0.0.1', () => {
			const { port } = bedrockMock.address() as AddressInfo;
			resolve(`http://127.0.0.1:${port}`);
		});
	});

const get = (url: string) => app.get(url).set('Authorization', `Bearer ${jwtToken}`);
const put = (url: string, body: object) => app.put(url).set('Authorization', `Bearer ${jwtToken}`).send(body);
const post = (url: string) => app.post(url).set('Authorization', `Bearer ${jwtToken}`).send({});

beforeAll(async () => {
	process.env.AI_BEDROCK_ENDPOINT = await startBedrockMock();
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

afterAll(() => {
	delete process.env.AI_BEDROCK_ENDPOINT;
	bedrockMock.close();
});

describe('AI config endpoints', () => {
	test('defaults before anything is saved', async () => {
		const res = await get('/api/v1/ai/config');
		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({
			provider: 'bedrock',
			region: 'us-east-1',
			modelId: '',
			enabled: false,
			hasApiKey: false,
		});
	});

	test('rejects unauthenticated and non-admin access', async () => {
		const unauthed = await app.get('/api/v1/ai/config');
		expect(unauthed.status).toBe(401);

		// A Viewer must get 403 — org-wide credentials are admin-only.
		await app
			.post('/api/v1/users')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ email: 'viewer@example.com', fullName: 'Viewer', password: 'password123', role: 'viewer' });
		const login = await app.post('/api/v1/users/login').send({ email: 'viewer@example.com', password: 'password123' });
		expect(login.body.token).toBeTruthy();
		const forbidden = await app.get('/api/v1/ai/config').set('Authorization', `Bearer ${login.body.token}`);
		expect(forbidden.status).toBe(403);
	});

	test('saving config stores the key encrypted and never returns it', async () => {
		const res = await put('/api/v1/ai/config', {
			region: 'eu-west-1',
			modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
			apiKey: 'good-key',
			enabled: true,
		});
		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({
			region: 'eu-west-1',
			modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
			enabled: true,
			hasApiKey: true,
		});
		expect(JSON.stringify(res.body)).not.toContain('good-key');

		// At rest: ciphertext, not the key.
		const row = db.prepare('SELECT api_key FROM ai_config WHERE id = 1').get() as { api_key: string };
		expect(row.api_key).toBeTruthy();
		expect(row.api_key).not.toContain('good-key');
	});

	test('partial update keeps the stored key; explicit null deletes it', async () => {
		const kept = await put('/api/v1/ai/config', { region: 'us-east-1' });
		expect(kept.body.data.hasApiKey).toBe(true);
		expect(kept.body.data.modelId).toBe('anthropic.claude-sonnet-4-5-20250929-v1:0');

		const cleared = await put('/api/v1/ai/config', { apiKey: null });
		expect(cleared.body.data.hasApiKey).toBe(false);

		// Restore for the tests below.
		await put('/api/v1/ai/config', { apiKey: 'good-key' });
	});

	test('config changes are audit-logged without key material', async () => {
		const res = await get('/api/v1/audit?page=1&pageSize=10');
		const logs = JSON.stringify(res.body);
		expect(logs).toContain('AI settings');
		expect(logs).not.toContain('good-key');
	});

	test('validation: bad region shape is a 400', async () => {
		const res = await put('/api/v1/ai/config', { region: 'Not A Region!' });
		expect(res.status).toBe(400);
	});
});

describe('POST /ai/test', () => {
	test('succeeds against the (mock) Converse API and reports the reply + latency', async () => {
		const res = await post('/api/v1/ai/test');
		expect(res.status).toBe(200);
		expect(res.body.data.ok).toBe(true);
		expect(res.body.data.message).toBe('ok');
		expect(res.body.data.latencyMs).toBeGreaterThanOrEqual(0);
		// The call carried the decrypted key as a bearer token and URI-encoded the model
		// id (the ':0' suffix must not break the path).
		expect(receivedAuth).toBe('Bearer good-key');
		expect(receivedPath).toContain(encodeURIComponent('anthropic.claude-sonnet-4-5-20250929-v1:0'));
	});

	test('an invalid key surfaces Bedrock’s auth error, not a 500', async () => {
		await put('/api/v1/ai/config', { apiKey: 'wrong-key' });
		const res = await post('/api/v1/ai/test');
		expect(res.status).toBe(200);
		expect(res.body.data.ok).toBe(false);
		expect(res.body.data.message).toContain('security token');
	});

	test('a bad model id surfaces Bedrock’s validation error', async () => {
		await put('/api/v1/ai/config', { apiKey: 'bad-model-key' });
		const res = await post('/api/v1/ai/test');
		expect(res.body.data.ok).toBe(false);
		expect(res.body.data.message).toContain('model identifier');
	});

	test('with no key configured the test explains itself instead of calling out', async () => {
		await put('/api/v1/ai/config', { apiKey: null });
		const res = await post('/api/v1/ai/test');
		expect(res.body.data.ok).toBe(false);
		expect(res.body.data.message).toContain('No API key');
	});
});
