import { AddressInfo } from 'node:net';
import http from 'node:http';
import { beforeAll, afterAll, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// The "bring your own" root-cause contract: upsert by an external system, on-demand
// read for the drawer, and operator ratings that are stored locally FIRST and then
// relayed to the sender's feedback callback (best-effort, never load-bearing).

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

// Ephemeral receiver standing in for the sender's feedback endpoint. Loopback is
// deliberately allowed by the callback guard (self-hosted senders are on private
// networks), which is also what makes this test possible.
interface ReceivedCallback {
	path: string;
	body: string;
}
let receiver: http.Server;
let receiverPort: number;
let received: ReceivedCallback[] = [];
let receiverStatus = 200;

const insertAlert = (id: string) => {
	db.prepare(
		`INSERT INTO alerts (id, status, tags, starts_at, updated_at, alert_url, alert_name, summary, is_dismissed)
		 VALUES (?, 'firing', '{}', ?, ?, ?, ?, 'Summary', 0)`
	).run(id, new Date().toISOString(), new Date().toISOString(), `https://example.com/${id}`, `Alert ${id}`);
};

const putRootCause = (alertId: string, body: object) =>
	app.put(`/api/v1/alerts/${alertId}/root-cause`).set('Authorization', `Bearer ${jwtToken}`).send(body);

const getRootCause = (alertId: string) =>
	app.get(`/api/v1/alerts/${alertId}/root-cause`).set('Authorization', `Bearer ${jwtToken}`);

const rate = (alertId: string, rating: string) =>
	app.post(`/api/v1/alerts/${alertId}/root-cause/rating`).set('Authorization', `Bearer ${jwtToken}`).send({ rating });

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);

	receiver = http.createServer((req, res) => {
		let body = '';
		req.on('data', (chunk: Buffer) => (body += chunk.toString()));
		req.on('end', () => {
			received.push({ path: req.url ?? '', body });
			res.statusCode = receiverStatus;
			res.end();
		});
	});
	await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
	receiverPort = (receiver.address() as AddressInfo).port;

	for (const id of ['rc-1', 'rc-2', 'rc-3', 'rc-4', 'rc-5', 'rc-cascade']) insertAlert(id);
});

afterAll(async () => {
	await new Promise<void>((resolve) => receiver.close(() => resolve()));
});

describe('root cause API', () => {
	test('upsert then read roundtrip, with callback URLs kept server-side', async () => {
		const put = await putRootCause('rc-1', {
			content: 'Pool exhausted after deploy 2481.',
			feedbackUpUrl: `http://127.0.0.1:${receiverPort}/up`,
			feedbackDownUrl: `http://127.0.0.1:${receiverPort}/down`,
		});
		expect(put.status).toBe(200);
		expect(put.body.success).toBe(true);

		const got = await getRootCause('rc-1');
		expect(got.status).toBe(200);
		expect(got.body.data.rootCause.content).toBe('Pool exhausted after deploy 2481.');
		expect(got.body.data.rootCause.source).toBe('api');
		expect(got.body.data.rootCause.rating).toBeNull();
		// The sender's callback URLs may embed tokens — they must never reach a client.
		expect(JSON.stringify(got.body)).not.toContain('feedbackUpUrl');
		expect(JSON.stringify(got.body)).not.toContain(`127.0.0.1:${receiverPort}`);
	});

	test('an alert with no analysis reads as 200 with null, not 404', async () => {
		const got = await getRootCause('rc-2');
		expect(got.status).toBe(200);
		expect(got.body.success).toBe(true);
		expect(got.body.data.rootCause).toBeNull();
	});

	test('upsert against an unknown alert is a 404', async () => {
		const put = await putRootCause('no-such-alert', { content: 'orphan analysis' });
		expect(put.status).toBe(404);
		expect(put.body.success).toBe(false);
	});

	test('upsert validates: empty content and over-cap content are 400s', async () => {
		expect((await putRootCause('rc-1', { content: '' })).status).toBe(400);
		expect((await putRootCause('rc-1', { content: 'x'.repeat(65537) })).status).toBe(400);
		expect((await putRootCause('rc-1', { content: 'ok', feedbackUpUrl: 'not a url' })).status).toBe(400);
	});

	test('rating is stored and the matching callback receives the verdict', async () => {
		received = [];
		const res = await rate('rc-1', 'up');
		expect(res.status).toBe(200);
		expect(res.body.data.rootCause.rating).toBe('up');
		expect(res.body.data.rootCause.ratedBy).toBe('Provider User');
		expect(res.body.data.callbackDelivered).toBe(true);

		expect(received).toHaveLength(1);
		expect(received[0].path).toBe('/up');
		const payload = JSON.parse(received[0].body) as { alertId: string; rating: string };
		expect(payload.alertId).toBe('rc-1');
		expect(payload.rating).toBe('up');

		// The verdict persists for later readers.
		const got = await getRootCause('rc-1');
		expect(got.body.data.rootCause.rating).toBe('up');
		expect(got.body.data.rootCause.ratedAt).toBeTruthy();
	});

	test('a failing callback still stores the rating', async () => {
		received = [];
		receiverStatus = 500;
		try {
			const res = await rate('rc-1', 'down');
			expect(res.status).toBe(200);
			expect(res.body.data.rootCause.rating).toBe('down');
			expect(res.body.data.callbackDelivered).toBe(false);
			expect(received).toHaveLength(1);
			expect(received[0].path).toBe('/down');
		} finally {
			receiverStatus = 200;
		}
	});

	test('a callback to the metadata range is refused, rating still stored', async () => {
		const put = await putRootCause('rc-3', {
			content: 'metadata probe',
			feedbackUpUrl: 'http://169.254.169.254/latest/meta-data',
		});
		expect(put.status).toBe(200);

		const res = await rate('rc-3', 'up');
		expect(res.status).toBe(200);
		expect(res.body.data.rootCause.rating).toBe('up');
		expect(res.body.data.callbackDelivered).toBe(false);
	});

	test('rating without any callback URL reports null delivery', async () => {
		await putRootCause('rc-4', { content: 'no callbacks configured' });
		const res = await rate('rc-4', 'down');
		expect(res.status).toBe(200);
		expect(res.body.data.callbackDelivered).toBeNull();
	});

	test('rating an alert that has no analysis is a 404', async () => {
		const res = await rate('rc-5', 'up');
		expect(res.status).toBe(404);
	});

	test('an invalid rating value is a 400', async () => {
		const res = await rate('rc-1', 'sideways');
		expect(res.status).toBe(400);
	});

	test('a re-pushed analysis clears the previous rating', async () => {
		await rate('rc-1', 'up');
		const put = await putRootCause('rc-1', { content: 'Revised: it was the cache, not the pool.' });
		expect(put.status).toBe(200);

		const got = await getRootCause('rc-1');
		expect(got.body.data.rootCause.content).toContain('Revised');
		expect(got.body.data.rootCause.rating).toBeNull();
		expect(got.body.data.rootCause.ratedBy).toBeNull();
	});

	test('rating lands in the audit log', async () => {
		const audit = await app.get('/api/v1/audit').set('Authorization', `Bearer ${jwtToken}`);
		expect(audit.status).toBe(200);
		interface AuditRow {
			resourceType: string;
			resourceName: string;
		}
		const rows = audit.body.data.logs as AuditRow[];
		expect(rows.some((row) => row.resourceType === 'ROOT_CAUSE' && row.resourceName.includes('rated'))).toBe(true);
	});

	test('an analysis survives resolve but not permanent deletion', async () => {
		await putRootCause('rc-cascade', { content: 'will outlive the resolve only' });

		// Resolve (the UI's delete on an active alert) — the analysis must survive.
		const resolve = await app
			.delete('/api/v1/alerts/rc-cascade')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({});
		expect(resolve.status).toBe(200);
		expect((await getRootCause('rc-cascade')).body.data.rootCause).not.toBeNull();

		// Permanent deletion of the resolved alert — the analysis goes with it.
		const del = await app.delete('/api/v1/alerts/resolved/rc-cascade').set('Authorization', `Bearer ${jwtToken}`);
		expect(del.status).toBe(200);
		expect((await getRootCause('rc-cascade')).body.data.rootCause).toBeNull();
	});

	test('deleting a RESOLVED id that is actually active does not shed the root cause', async () => {
		// rc-2 is active. DELETE /alerts/resolved/:id against it removes zero resolved
		// rows — the permanent-deletion cascade must not fire.
		await putRootCause('rc-2', { content: 'must survive a no-op resolved delete' });
		const del = await app.delete('/api/v1/alerts/resolved/rc-2').set('Authorization', `Bearer ${jwtToken}`);
		expect(del.status).toBe(200);
		expect((await getRootCause('rc-2')).body.data.rootCause).not.toBeNull();
	});

	test('an analysis can be pushed for an already-resolved alert', async () => {
		db.prepare(
			`INSERT INTO alerts_resolved (id, status, starts_at, updated_at, alert_url, alert_name, created_at)
			 VALUES ('rc-resolved', 'resolved', ?, ?, 'https://example.com/r', 'Resolved Alert', ?)`
		).run(new Date().toISOString(), new Date().toISOString(), new Date().toISOString());

		const put = await putRootCause('rc-resolved', { content: 'post-mortem arrived late' });
		expect(put.status).toBe(200);
		expect((await getRootCause('rc-resolved')).body.data.rootCause.content).toBe('post-mortem arrived late');
	});
});
