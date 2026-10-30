import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { AlertHistoryData, AlertHistoryEventType, HttpActionConfig } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { SuperTest, Test } from 'supertest';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// Running an action on an alert puts an `action_run` entry on the alert's timeline. Its
// description has to say how the run went: a failed run must not read "Ran action", and
// the run's result message (which can hold the receiver's response body) stays out.

interface Receiver {
	url: string;
	stop: () => Promise<void>;
}

interface RunCase {
	name: string;
	config: HttpActionConfig;
}

interface RunOutcome {
	ok: boolean;
	message: string;
	entries: AlertHistoryData[];
}

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;
let alertCounter = 0;

const receivers: Receiver[] = [];

const startReceiver = async (): Promise<Receiver> => {
	const server = http.createServer((req, res) => {
		req.resume();
		req.on('end', () => {
			res.statusCode = 200;
			res.end('receiver body');
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const receiver: Receiver = {
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`,
		stop: async () => {
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		},
	};
	receivers.push(receiver);
	return receiver;
};

const auth = (req: Test) => req.set('Authorization', `Bearer ${jwtToken}`);

const insertAlert = (id: string, name: string) => {
	db.prepare(
		`INSERT INTO alerts (id, status, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url, is_dismissed)
		 VALUES (?, 'firing', ?, ?, ?, ?, ?, 'Summary', NULL, 0)`
	).run(
		id,
		JSON.stringify({ env: 'prod' }),
		new Date().toISOString(),
		new Date().toISOString(),
		`https://x/${id}`,
		name
	);
};

// Creates the action, runs it once on a fresh alert, and returns the run result together
// with the alert's `action_run` timeline entries.
const runOnFreshAlert = async (runCase: RunCase): Promise<RunOutcome> => {
	alertCounter += 1;
	const alertId = `action-run-history-${alertCounter}`;
	const alertName = 'Disk full';
	insertAlert(alertId, alertName);

	const created = await auth(app.post('/api/v1/actions')).send({
		name: runCase.name,
		type: 'http',
		config: runCase.config,
	});
	expect(created.status).toBe(201);

	const run = await auth(app.post(`/api/v1/actions/${created.body.data.id}/run`)).send({
		alert: { id: alertId, alertName },
	});
	expect(run.status).toBe(200);

	const history = await auth(app.get(`/api/v1/alerts/${alertId}/history`));
	expect(history.status).toBe(200);
	const entries = (history.body.data.data as AlertHistoryData[]).filter(
		(entry) => entry.eventType === AlertHistoryEventType.ACTION_RUN
	);
	return { ok: run.body.data.ok, message: run.body.data.message, entries };
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

describe('action_run history entry', () => {
	test('a successful run reads "Ran action"', async () => {
		const receiver = await startReceiver();
		const outcome = await runOnFreshAlert({
			name: 'hook ok',
			config: { url: receiver.url, method: 'POST', bodyTemplate: '{{name}}' },
		});

		expect(outcome.ok).toBe(true);
		expect(outcome.entries).toHaveLength(1);
		expect(outcome.entries[0].description).toBe('Ran action "hook ok"');
		expect(outcome.entries[0].actorName).toBe('Provider User');
	});

	test('a "don\'t wait for a response" run reads "Sent action"', async () => {
		const receiver = await startReceiver();
		const outcome = await runOnFreshAlert({
			name: 'hook sent',
			config: { url: receiver.url, method: 'POST', bodyTemplate: '{{name}}', fireAndForget: true },
		});

		expect(outcome.ok).toBe(true);
		expect(outcome.entries).toHaveLength(1);
		expect(outcome.entries[0].description).toBe('Sent action "hook sent" (not waiting for a response)');
		expect(outcome.entries[0].actorName).toBe('Provider User');
	});

	test('a failed run reads "failed" and leaves the result message out', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const outcome = await runOnFreshAlert({
			name: 'hook down',
			config: { url: 'http://127.0.0.1:1/hook', method: 'POST', bodyTemplate: '{{name}}' },
		});

		expect(outcome.ok).toBe(false);
		expect(outcome.message).toBeTruthy();
		expect(outcome.entries).toHaveLength(1);
		expect(outcome.entries[0].description).toBe('Action "hook down" failed');
		expect(outcome.entries[0].description).not.toContain('fetch failed');
		expect(outcome.entries[0].description).not.toContain(outcome.message);
		expect(outcome.entries[0].actorName).toBe('Provider User');
	});
});
