import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { SuperTest, Test } from 'supertest';
import type Database from 'better-sqlite3';
import { actionsRunTotal } from '../src/metrics';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// POST /api/v1/actions/test is the "Send test" button in the action form: it validates
// a (possibly unsaved) action and runs it once against a sample alert. Unlike a real
// run (runOnAlert), a test run must leave no trace — it does not bump the run counter,
// it writes no alert-history event, and it saves nothing. Every test talks to a local
// node:http receiver, so nothing touches the network.

interface ReceivedRequest {
	method: string;
	url: string;
	headers: http.IncomingHttpHeaders;
	body: string;
}

interface Receiver {
	url: string;
	received: ReceivedRequest[];
	stop: () => Promise<void>;
}

interface CountRow {
	c: number;
}

const startReceiver = async (status: number): Promise<Receiver> => {
	const receiver: Receiver = { url: '', received: [], stop: () => Promise.resolve() };
	const server = http.createServer((req, res) => {
		let body = '';
		req.on('data', (chunk: Buffer) => (body += chunk.toString()));
		req.on('end', () => {
			receiver.received.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
			res.statusCode = status;
			res.end('answer');
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	receiver.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
	receiver.stop = async () => {
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	};
	return receiver;
};

const waitUntil = async (predicate: () => boolean, label: string, timeoutMs = 5000): Promise<void> => {
	const started = Date.now();
	while (!predicate()) {
		if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${label}`);
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
};

describe('POST /api/v1/actions/test', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	let jwtToken: string;

	const authed = (req: Test) => req.set('Authorization', `Bearer ${jwtToken}`);

	const receivers: Receiver[] = [];
	const receiverWith = async (status: number): Promise<Receiver> => {
		const receiver = await startReceiver(status);
		receivers.push(receiver);
		return receiver;
	};

	const runCount = async (outcome: string): Promise<number> => {
		const metric = await actionsRunTotal.get();
		return metric.values.find((v) => v.labels.type === 'http' && v.labels.outcome === outcome)?.value ?? 0;
	};

	beforeAll(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
		jwtToken = await setupUserWithToken(app);
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await Promise.all(receivers.splice(0).map((receiver) => receiver.stop()));
	});

	test('without a token the route refuses with 401', async () => {
		const res = await app.post('/api/v1/actions/test').send({
			name: 'No auth',
			type: 'http',
			config: { url: 'http://127.0.0.1:1/hook', method: 'POST' },
		});
		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	test('a bad body is a 400 validation error and nothing reaches the receiver', async () => {
		const receiver = await receiverWith(200);
		const badBodies = [
			{ type: 'http', config: { url: receiver.url, method: 'POST' } }, // no name
			{ name: 'bad slack', type: 'slack', config: { webhookUrl: 'not-a-url' } }, // webhook not a URL
			{ name: 'weird', type: 'email', config: {} }, // unknown type
		];
		for (const body of badBodies) {
			const res = await authed(app.post('/api/v1/actions/test')).send(body);
			expect(res.status).toBe(400);
			expect(res.body.success).toBe(false);
			expect(res.body.error).toBe('Validation error');
		}
		expect(receiver.received.length).toBe(0);
	});

	test('the sample context resolves every template variable', async () => {
		const receiver = await receiverWith(200);
		const res = await authed(app.post('/api/v1/actions/test')).send({
			name: 'Render the sample',
			type: 'http',
			config: {
				url: receiver.url,
				method: 'POST',
				bodyFormat: 'json',
				bodyTemplate:
					'{"name":"{{name}}","severity":"{{severity}}","env":"{{label.env}}","team":"{{alert.tags.team}}"}',
				headers: { 'X-Alert-Id': '{{id}}' },
			},
		});
		expect(res.status).toBe(200);
		expect(res.body.data.ok).toBe(true);

		await waitUntil(() => receiver.received.length === 1, 'the request to arrive');
		const sent = receiver.received[0];
		const parsed = JSON.parse(sent.body) as Record<string, string>;
		expect(parsed.name).toBe('Test alert from OpsiMate');
		expect(parsed.severity).toBe('critical');
		expect(parsed.env).toBe('prod');
		expect(parsed.team).toBe('platform');
		expect(sent.headers['x-alert-id']).toBe('test-alert-1');
		expect(sent.body).not.toContain('{{');
	});

	test('a receiver that answers 200 reports success', async () => {
		const receiver = await receiverWith(200);
		const res = await authed(app.post('/api/v1/actions/test')).send({
			name: 'Ping',
			type: 'http',
			config: { url: receiver.url, method: 'POST', bodyTemplate: 'hi' },
		});
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.ok).toBe(true);
		expect(res.body.data.statusCode).toBe(200);
	});

	test('a receiver that answers 500 still yields HTTP 200 with ok=false', async () => {
		const receiver = await receiverWith(500);
		const res = await authed(app.post('/api/v1/actions/test')).send({
			name: 'Ping 500',
			type: 'http',
			config: { url: receiver.url, method: 'POST', bodyTemplate: 'hi' },
		});
		expect(res.status).toBe(200);
		expect(res.body.data.ok).toBe(false);
		expect(typeof res.body.data.message).toBe('string');
		expect(res.body.data.message.length).toBeGreaterThan(0);
	});

	test('a refused connection still yields HTTP 200 with ok=false, never a 500', async () => {
		const closed = await startReceiver(200);
		await closed.stop();
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const res = await authed(app.post('/api/v1/actions/test')).send({
			name: 'Ping refused',
			type: 'http',
			config: { url: closed.url, method: 'POST', bodyTemplate: 'hi' },
		});
		expect(res.status).toBe(200);
		expect(res.body.data.ok).toBe(false);
		expect(typeof res.body.data.message).toBe('string');
		expect(res.body.data.message.length).toBeGreaterThan(0);
		expect(error).toHaveBeenCalled();
	});

	test('a test run leaves no trace: no run metric, no history row, nothing saved', async () => {
		const receiver = await receiverWith(200);
		const successBefore = await runCount('success');
		const errorBefore = await runCount('error');
		const sentBefore = await runCount('sent');
		const historyBefore = (db.prepare('SELECT COUNT(*) AS c FROM alert_history_events').get() as CountRow).c;

		const res = await authed(app.post('/api/v1/actions/test')).send({
			name: 'Leave no trace',
			type: 'http',
			config: { url: receiver.url, method: 'POST', bodyTemplate: 'hi' },
		});
		expect(res.status).toBe(200);
		expect(res.body.data.ok).toBe(true);

		expect(await runCount('success')).toBe(successBefore);
		expect(await runCount('error')).toBe(errorBefore);
		expect(await runCount('sent')).toBe(sentBefore);

		const historyAfter = (db.prepare('SELECT COUNT(*) AS c FROM alert_history_events').get() as CountRow).c;
		expect(historyAfter).toBe(historyBefore);

		const listed = await authed(app.get('/api/v1/actions'));
		expect(listed.status).toBe(200);
		expect(listed.body.data).toEqual([]);
	});
});
