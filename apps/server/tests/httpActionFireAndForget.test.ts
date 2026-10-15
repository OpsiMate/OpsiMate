import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import type { Action, HttpActionConfig } from '@OpsiMate/shared';
import { ActionBL } from '../src/bl/actions/action.bl';
import type { AuditBL } from '../src/bl/audit/audit.bl';
import { buildSampleContext, executeAction, ExecutableAction } from '../src/bl/actions/actionExecutor';
import type { ActionRepository } from '../src/dal/actionRepository';
import { actionsRunTotal } from '../src/metrics';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// HTTP actions with "don't wait for a response" (fireAndForget): the run is reported
// successful once the request has been SENT, the receiver's answer is only logged, and
// anything that fails before the request is out still fails the run. Every test talks
// to a real node:http receiver, so what is asserted is the wire behaviour.

interface ReceivedRequest {
	method: string;
	url: string;
	headers: http.IncomingHttpHeaders;
	body: string;
}

interface ReceiverOptions {
	// Delay before the receiver answers; Infinity = never answers.
	delayMs: number;
	status: number;
}

interface Receiver {
	url: string;
	received: ReceivedRequest[];
	responded: number;
	stop: () => Promise<void>;
}

const startReceiver = async (options: ReceiverOptions): Promise<Receiver> => {
	const receiver: Receiver = { url: '', received: [], responded: 0, stop: () => Promise.resolve() };
	const server = http.createServer((req, res) => {
		let body = '';
		req.on('data', (chunk: Buffer) => (body += chunk.toString()));
		req.on('end', () => {
			receiver.received.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
			if (!Number.isFinite(options.delayMs)) return;
			setTimeout(() => {
				receiver.responded += 1;
				res.statusCode = options.status;
				res.end('answer');
			}, options.delayMs);
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

const httpAction = (config: Partial<HttpActionConfig> & { url: string }): ExecutableAction => ({
	name: 'Kick off the deploy',
	type: 'http',
	config: {
		method: 'POST',
		headers: { 'X-Token': 'secret-{{severity}}' },
		bodyTemplate: '{"alert":"{{name}}"}',
		...config,
	},
});

const waitUntil = async (predicate: () => boolean, label: string, timeoutMs = 5000): Promise<void> => {
	const started = Date.now();
	while (!predicate()) {
		if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${label}`);
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
};

const receivers: Receiver[] = [];
const receiverWith = async (options: ReceiverOptions): Promise<Receiver> => {
	const receiver = await startReceiver(options);
	receivers.push(receiver);
	return receiver;
};

// A lost connection after the run already returned must never surface as a crash.
const uncaught: Error[] = [];
const onUncaught = (error: Error) => {
	uncaught.push(error);
};

beforeAll(() => {
	process.on('uncaughtException', onUncaught);
	process.on('unhandledRejection', onUncaught);
});

afterAll(() => {
	process.off('uncaughtException', onUncaught);
	process.off('unhandledRejection', onUncaught);
});

afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(receivers.splice(0).map((receiver) => receiver.stop()));
	expect(uncaught).toEqual([]);
});

describe('executeAction with fireAndForget', () => {
	test('returns ok as soon as the request is sent, before the receiver answers', async () => {
		const receiver = await receiverWith({ delayMs: 300, status: 200 });
		const result = await executeAction(
			httpAction({ url: receiver.url, fireAndForget: true }),
			buildSampleContext()
		);

		// The run came back while the receiver was still "working" on its answer.
		expect(result.ok).toBe(true);
		expect(result.statusCode).toBeUndefined();
		expect(result.message).toMatch(/not waiting for a response/);
		expect(receiver.responded).toBe(0);

		// "Sent" means handed to the socket; the receiver reads it a tick later, complete,
		// templates resolved, with the default content type.
		await waitUntil(() => receiver.received.length === 1, 'the request to arrive');
		expect(receiver.received[0].method).toBe('POST');
		expect(receiver.received[0].url).toBe('/hook');
		expect(receiver.received[0].body).toBe('{"alert":"Test alert from OpsiMate"}');
		expect(receiver.received[0].headers['x-token']).toBe('secret-critical');
		expect(receiver.received[0].headers['content-type']).toBe('application/json');

		// The late answer is consumed quietly.
		const info = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		await waitUntil(() => receiver.responded === 1, 'the receiver to answer');
		await waitUntil(
			() => info.mock.calls.some((call) => String(call[0]).includes('receiver answered 200')),
			'the answer to be logged'
		);
	});

	test('without the flag the run still waits for the status code', async () => {
		const receiver = await receiverWith({ delayMs: 200, status: 200 });
		const result = await executeAction(
			httpAction({ url: receiver.url, fireAndForget: false }),
			buildSampleContext()
		);
		expect(result.ok).toBe(true);
		expect(result.statusCode).toBe(200);
		expect(receiver.responded).toBe(1);
	});

	test('a receiver that answers with an error is still "sent" — the status is only logged', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const receiver = await receiverWith({ delayMs: 20, status: 500 });
		const result = await executeAction(
			httpAction({ url: receiver.url, fireAndForget: true }),
			buildSampleContext()
		);
		expect(result.ok).toBe(true);
		await waitUntil(
			() => warn.mock.calls.some((call) => String(call[0]).includes('receiver answered 500')),
			'the 500 to be logged'
		);
	});

	test('a receiver that never answers: the run is sent, and losing the connection later is harmless', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const receiver = await receiverWith({ delayMs: Infinity, status: 200 });
		const result = await executeAction(
			httpAction({ url: receiver.url, fireAndForget: true }),
			buildSampleContext()
		);
		expect(result.ok).toBe(true);
		await waitUntil(() => receiver.received.length === 1, 'the request to arrive');

		await receiver.stop();
		await waitUntil(
			() => warn.mock.calls.some((call) => String(call[0]).includes('connection ended before a response')),
			'the dropped connection to be logged'
		);
		expect(uncaught).toEqual([]);
	});

	test('a refused connection fails the run, even without waiting', async () => {
		const closed = await startReceiver({ delayMs: 0, status: 200 });
		await closed.stop();
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const result = await executeAction(httpAction({ url: closed.url, fireAndForget: true }), buildSampleContext());
		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/ECONNREFUSED/);
		expect(error).toHaveBeenCalled();
	});

	test('https against a plain-HTTP port fails the run instead of claiming "sent"', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const plain = await receiverWith({ delayMs: 10, status: 200 });
		const result = await executeAction(
			httpAction({ url: plain.url.replace('http://', 'https://'), fireAndForget: true }),
			buildSampleContext()
		);
		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/EPROTO|ECONNRESET|closed|wrong version/i);
	});

	test('an unsupported scheme fails the run instead of hanging', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const result = await executeAction(
			httpAction({ url: 'ftp://files.example.com/{{id}}', fireAndForget: true }),
			buildSampleContext()
		);
		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/ftp/);
	});

	test('GET sends no body and no content type', async () => {
		const receiver = await receiverWith({ delayMs: 10, status: 204 });
		const result = await executeAction(
			httpAction({ url: `${receiver.url}?alert={{id}}`, method: 'GET', fireAndForget: true }),
			buildSampleContext()
		);
		expect(result.ok).toBe(true);
		await waitUntil(() => receiver.received.length === 1, 'the request to arrive');
		expect(receiver.received[0].url).toBe('/hook?alert=test-alert-1');
		expect(receiver.received[0].body).toBe('');
		expect(receiver.received[0].headers['content-type']).toBeUndefined();
		await waitUntil(() => receiver.responded === 1, 'the receiver to answer');
	});
});

describe('opsimate_actions_run_total for fire-and-forget runs', () => {
	const runCount = async (outcome: string): Promise<number> => {
		const metric = await actionsRunTotal.get();
		return metric.values.find((v) => v.labels.type === 'http' && v.labels.outcome === outcome)?.value ?? 0;
	};

	test('counts a sent request as "sent", never as "success"', async () => {
		const receiver = await receiverWith({ delayMs: 20, status: 200 });
		const action: Action = {
			id: 1,
			...httpAction({ url: receiver.url, fireAndForget: true }),
			labelMatchers: [],
			createdAt: '2026-10-15T00:00:00.000Z',
			updatedAt: '2026-10-15T00:00:00.000Z',
		};
		const actionBL = new ActionBL({} as ActionRepository, {} as AuditBL);
		const sentBefore = await runCount('sent');
		const successBefore = await runCount('success');

		const result = await actionBL.runOnAlert(action, { alertName: 'Disk full' });
		expect(result.ok).toBe(true);
		expect(await runCount('sent')).toBe(sentBefore + 1);
		expect(await runCount('success')).toBe(successBefore);
		await waitUntil(() => receiver.responded === 1, 'the receiver to answer');
	});
});

describe('fireAndForget over the API', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	let jwtToken: string;

	const authed = (req: Test) => req.set('Authorization', `Bearer ${jwtToken}`);

	beforeAll(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
		jwtToken = await setupUserWithToken(app);
	});

	test('the flag is stored, returned, and honoured when the action runs on an alert', async () => {
		// Generous delay: this path includes the supertest round-trip and the history write.
		const receiver = await receiverWith({ delayMs: 1000, status: 200 });
		const created = await authed(app.post('/api/v1/actions')).send({
			name: 'Trigger the runbook job',
			type: 'http',
			config: { url: receiver.url, method: 'POST', bodyTemplate: '{{name}}', fireAndForget: true },
		});
		expect(created.status).toBe(201);
		expect(created.body.data.config.fireAndForget).toBe(true);

		const listed = await authed(app.get('/api/v1/actions'));
		const stored = listed.body.data.find((a: Action) => a.id === created.body.data.id);
		expect((stored.config as HttpActionConfig).fireAndForget).toBe(true);

		const run = await authed(app.post(`/api/v1/actions/${created.body.data.id}/run`)).send({
			alert: { id: 'disk-1', alertName: 'Disk full' },
		});
		expect(run.status).toBe(200);
		expect(run.body.data.ok).toBe(true);
		expect(run.body.data.message).toMatch(/not waiting/);
		expect(receiver.responded).toBe(0);
		await waitUntil(() => receiver.received.length === 1, 'the request to arrive');
		expect(receiver.received[0].body).toBe('Disk full');
		await waitUntil(() => receiver.responded === 1, 'the receiver to answer');
	});

	test('the flag is optional and absent by default', async () => {
		const created = await authed(app.post('/api/v1/actions')).send({
			name: 'Plain request',
			type: 'http',
			config: { url: 'https://api.example.com/hook', method: 'POST' },
		});
		expect(created.status).toBe(201);
		expect(created.body.data.config.fireAndForget).toBeUndefined();

		const rejected = await authed(app.post('/api/v1/actions')).send({
			name: 'Bad flag',
			type: 'http',
			config: { url: 'https://api.example.com/hook', method: 'POST', fireAndForget: 'yes' },
		});
		expect(rejected.status).toBe(400);
	});
});
