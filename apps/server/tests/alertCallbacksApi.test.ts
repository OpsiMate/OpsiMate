import http from 'node:http';
import { AddressInfo } from 'node:net';
import {
	ALERT_CALLBACK_EVENTS,
	AlertCallback,
	AlertCallbackEvent,
	AlertCallbackPayload,
	AlertCallbackWithSecret,
	AlertStatus,
	AuditResourceType,
} from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { SuperTest, Test } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';
import { signCallback } from '../src/bl/callbacks/callbackDispatcher';

// End to end: an admin configures a callback on the Settings API, a user changes an
// alert, and a real HTTP receiver gets the request — AFTER the change is in the
// database, and without the user's request waiting for it.

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;
let receiver: http.Server;
let receiverUrl: string;

interface ReceivedRequest {
	path: string;
	method: string;
	headers: http.IncomingHttpHeaders;
	body: string;
	// What the alerts table said about the first alert when the request ARRIVED.
	silencedInDbOnArrival: boolean | null;
	receivedAt: number;
}

// A create body as the API takes it; loose on purpose so validation tests can send bad values.
type CallbackRequestBody = Record<string, unknown>;

interface AlertDismissedRow {
	is_dismissed: number;
}

interface CallbackStatusRow {
	last_status: string | null;
}

interface AuditLogEntry {
	actionType: string;
	resourceType: string;
	resourceName: string;
	details?: string;
}

// One API call in an alert's life and the callback events (with details) it must fire.
type ExpectedEvent = [AlertCallbackEvent, Record<string, unknown>];

interface LifecycleStep {
	run: () => Test;
	expect: ExpectedEvent[];
}

let received: ReceivedRequest[] = [];
let respondWith = 200;

const payloadOf = (request: ReceivedRequest): AlertCallbackPayload => JSON.parse(request.body) as AlertCallbackPayload;

const waitFor = async (predicate: () => boolean, label: string, timeoutMs = 5_000): Promise<void> => {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
};

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

const auth = (req: Test) => req.set('Authorization', `Bearer ${jwtToken}`);
const createCallback = (body: CallbackRequestBody) => auth(app.post('/api/v1/callbacks')).send(body);

const baseCallback = (path: string, events: string[], extra: CallbackRequestBody = {}): CallbackRequestBody => ({
	name: `Receiver ${path}`,
	url: `${receiverUrl}${path}`,
	events,
	enabled: true,
	...extra,
});

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);

	receiver = http.createServer((req, res) => {
		let body = '';
		req.on('data', (chunk: Buffer) => {
			body += chunk.toString();
		});
		req.on('end', () => {
			let silencedInDbOnArrival: boolean | null;
			try {
				const alertId = (JSON.parse(body) as AlertCallbackPayload).alerts?.[0]?.id;
				const row = db.prepare('SELECT is_dismissed FROM alerts WHERE id = ?').get(alertId) as
					AlertDismissedRow | undefined;
				silencedInDbOnArrival = row ? row.is_dismissed === 1 : null;
			} catch {
				silencedInDbOnArrival = null;
			}
			received.push({
				path: req.url ?? '',
				method: req.method ?? '',
				headers: req.headers,
				body,
				silencedInDbOnArrival,
				receivedAt: Date.now(),
			});
			res.statusCode = respondWith;
			res.end(respondWith >= 400 ? 'receiver says no' : 'ok');
		});
	});
	await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
	receiverUrl = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}`;
});

beforeEach(() => {
	received = [];
	respondWith = 200;
	db.exec('DELETE FROM alert_callbacks');
	db.exec('DELETE FROM audit_logs');
});

afterAll(async () => {
	await new Promise<void>((resolve) => receiver.close(() => resolve()));
	db.close();
});

describe('Callbacks API: configuration', () => {
	test('a new callback is OFF by default and gets a generated secret', async () => {
		const res = await createCallback({ name: 'Pager', url: 'https://pager.test/hook', events: ['silenced'] });
		expect(res.status).toBe(201);
		const callback: AlertCallbackWithSecret = res.body.data;
		expect(callback.enabled).toBe(false);
		expect(callback.method).toBe('POST');
		expect(callback.secret).toMatch(/^[0-9a-f]{48}$/);
		expect(callback.events).toEqual(['silenced']);
		expect(callback.lastStatus).toBeNull();

		// The secret is handed out on create (and rotate) only: list and get leave it out.
		const list = await auth(app.get('/api/v1/callbacks'));
		expect(list.status).toBe(200);
		expect(list.body.data.map((c: AlertCallback) => c.id)).toEqual([callback.id]);
		expect(list.body.data[0]).not.toHaveProperty('secret');
		expect((await auth(app.get(`/api/v1/callbacks/${callback.id}`))).body.data).not.toHaveProperty('secret');
	});

	test('validation: a URL, at least one known event, unique events', async () => {
		expect((await createCallback({ name: 'x', url: 'not-a-url', events: ['silenced'] })).status).toBe(400);
		expect((await createCallback({ name: 'x', url: 'https://a.test', events: [] })).status).toBe(400);
		expect((await createCallback({ name: 'x', url: 'https://a.test', events: ['ingested'] })).status).toBe(400);
		expect(
			(await createCallback({ name: 'x', url: 'https://a.test', events: ['silenced', 'silenced'] })).status
		).toBe(400);
		expect(
			(await createCallback({ name: 'x', url: 'https://a.test', events: ['silenced'], secret: 'short' })).status
		).toBe(400);
		expect((await createCallback({ name: 'x', url: 'ftp://a.test/x', events: ['silenced'] })).status).toBe(400);
		expect(
			(
				await createCallback({
					name: 'x',
					url: 'https://a.test',
					events: ['silenced'],
					headers: { 'Bad Name': 'v' },
				})
			).status
		).toBe(400);
		expect(
			(
				await createCallback({
					name: 'x',
					url: 'https://a.test',
					events: ['silenced'],
					headers: { 'X-A': 'v\r\nX-B: w' },
				})
			).status
		).toBe(400);
	});

	test('a partial update leaves enabled and method alone (zod defaults must not re-apply)', async () => {
		const created = (
			await createCallback({
				name: 'Pager',
				url: 'https://pager.test/hook',
				method: 'PUT',
				events: ['silenced'],
				enabled: true,
			})
		).body.data as AlertCallback;
		expect(created.enabled).toBe(true);
		expect(created.method).toBe('PUT');

		const renamed = await auth(app.put(`/api/v1/callbacks/${created.id}`)).send({ name: 'Pager 2' });
		expect(renamed.body.data.enabled).toBe(true);
		expect(renamed.body.data.method).toBe('PUT');

		const rotated = await auth(app.put(`/api/v1/callbacks/${created.id}`)).send({ secret: 'rotated-secret-xyz' });
		expect(rotated.body.data.enabled).toBe(true);
		expect(rotated.body.data.method).toBe('PUT');
		expect(rotated.body.data.secret).toBe('rotated-secret-xyz');
	});

	test('update takes partial bodies (the on/off switch), delete removes, unknown ids are 404', async () => {
		const created = (await createCallback({ name: 'Pager', url: 'https://pager.test/hook', events: ['silenced'] }))
			.body.data as AlertCallback;

		const toggled = await auth(app.put(`/api/v1/callbacks/${created.id}`)).send({ enabled: true });
		expect(toggled.status).toBe(200);
		expect(toggled.body.data.enabled).toBe(true);
		expect(toggled.body.data.url).toBe('https://pager.test/hook');
		// An edit that does not rotate the secret does not return it.
		expect(toggled.body.data).not.toHaveProperty('secret');

		const rotated = await auth(app.put(`/api/v1/callbacks/${created.id}`)).send({ secret: 'my-own-secret-value' });
		expect(rotated.body.data.secret).toBe('my-own-secret-value');

		expect((await auth(app.delete(`/api/v1/callbacks/${created.id}`))).status).toBe(200);
		expect((await auth(app.get(`/api/v1/callbacks/${created.id}`))).status).toBe(404);
		expect((await auth(app.put(`/api/v1/callbacks/${created.id}`)).send({ enabled: true })).status).toBe(404);
		expect((await auth(app.delete(`/api/v1/callbacks/${created.id}`))).status).toBe(404);
	});

	test('create, update and delete are audited, without the secret or header values', async () => {
		const created = (await createCallback({ name: 'Pager', url: 'https://pager.test/hook', events: ['silenced'] }))
			.body.data as AlertCallback;
		await auth(app.put(`/api/v1/callbacks/${created.id}`)).send({
			enabled: true,
			secret: 'rotated-secret-1',
			headers: { Authorization: 'Bearer receiver-token-1' },
		});
		await auth(app.delete(`/api/v1/callbacks/${created.id}`));

		const logs = (await auth(app.get('/api/v1/audit'))).body.data.logs as AuditLogEntry[];
		expect(logs.map((l) => [l.actionType, l.resourceType, l.resourceName]).sort()).toEqual([
			['CREATE', AuditResourceType.CALLBACK, 'Pager'],
			['DELETE', AuditResourceType.CALLBACK, 'Pager'],
			['UPDATE', AuditResourceType.CALLBACK, 'Pager'],
		]);
		const update = logs.find((l) => l.actionType === 'UPDATE');
		expect(update?.details).toContain('"enabled":true');
		expect(update?.details).not.toContain('rotated-secret-1');
		// Header names are logged, never their values (that's where the receiver's token lives).
		expect(update?.details).toContain('Authorization');
		expect(update?.details).not.toContain('receiver-token-1');
	});

	test('the audit log never holds the URL or body template (receivers carry credentials in them)', async () => {
		const created = (
			await createCallback({
				name: 'Slack',
				url: 'https://hooks.slack.test/services/T000/B000/create-path-token',
				events: ['silenced'],
				bodyTemplate: '{"token":"create-body-token"}',
			})
		).body.data as AlertCallback;
		await auth(app.put(`/api/v1/callbacks/${created.id}`)).send({
			name: 'Slack 2',
			url: 'https://hooks.slack.test/services/T000/B000/update-path-token?token=update-query-token',
			bodyTemplate: '{"token":"update-body-token"}',
			method: 'PUT',
			events: ['silenced', 'resolved'],
			enabled: true,
		});
		await auth(app.delete(`/api/v1/callbacks/${created.id}`));

		const logs = (await auth(app.get('/api/v1/audit'))).body.data.logs as AuditLogEntry[];
		expect(logs).toHaveLength(3);
		const everything = JSON.stringify(logs);
		for (const secret of [
			'create-path-token',
			'create-body-token',
			'update-path-token',
			'update-query-token',
			'update-body-token',
		]) {
			expect(everything).not.toContain(secret);
		}
		// The harmless fields still say what changed.
		const update = JSON.parse(logs.find((l) => l.actionType === 'UPDATE')?.details ?? '{}') as Record<
			string,
			unknown
		>;
		expect(update).toEqual({
			name: 'Slack 2',
			url: '[changed]',
			bodyTemplate: '[changed]',
			method: 'PUT',
			events: ['silenced', 'resolved'],
			enabled: true,
		});
	});

	test('POST /callbacks/test sends one sample request and reports the receiver answer', async () => {
		const ok = await auth(app.post('/api/v1/callbacks/test')).send({
			url: `${receiverUrl}/probe`,
			method: 'POST',
			secret: 'probe-secret-1',
		});
		expect(ok.status).toBe(200);
		expect(ok.body.data).toEqual({ ok: true, statusCode: 200, message: 'Delivered (200)' });
		expect(received).toHaveLength(1);
		expect(received[0].headers['x-opsimate-event']).toBe('silenced');
		expect(received[0].headers['x-opsimate-signature']).toBe(
			signCallback('probe-secret-1', Number(received[0].headers['x-opsimate-timestamp']), received[0].body)
		);
		expect(payloadOf(received[0]).alerts[0].alertName).toBe('Test alert from OpsiMate');

		respondWith = 503;
		const failed = await auth(app.post('/api/v1/callbacks/test')).send({ url: `${receiverUrl}/probe` });
		expect(failed.body.data.ok).toBe(false);
		expect(failed.body.data.statusCode).toBe(503);
		expect(failed.body.data.message).toContain('receiver says no');
	});
});

describe('Callbacks API: test with a saved secret', () => {
	test('callbackId signs the test with the stored secret; a typed secret wins; unknown id is 404', async () => {
		const created = (await createCallback(baseCallback('/probe-saved', ['silenced']))).body
			.data as AlertCallbackWithSecret;
		const testBody = { url: `${receiverUrl}/probe-saved`, method: 'POST' };

		const saved = await auth(app.post('/api/v1/callbacks/test')).send({ ...testBody, callbackId: created.id });
		expect(saved.status).toBe(200);
		expect(saved.body.data.ok).toBe(true);
		await waitFor(() => received.length >= 1, 'saved-secret test');
		expect(received[0].headers['x-opsimate-signature']).toBe(
			signCallback(created.secret, Number(received[0].headers['x-opsimate-timestamp']), received[0].body)
		);

		const typed = await auth(app.post('/api/v1/callbacks/test')).send({
			...testBody,
			callbackId: created.id,
			secret: 'typed-secret-wins',
		});
		expect(typed.status).toBe(200);
		await waitFor(() => received.length >= 2, 'typed-secret test');
		expect(received[1].headers['x-opsimate-signature']).toBe(
			signCallback('typed-secret-wins', Number(received[1].headers['x-opsimate-timestamp']), received[1].body)
		);

		expect((await auth(app.post('/api/v1/callbacks/test')).send({ ...testBody, callbackId: 987654 })).status).toBe(
			404
		);
	});
});

describe('Callbacks: delivery on alert changes', () => {
	test('silencing an alert reaches the receiver after the change is committed, signed, with the actor', async () => {
		insertAlert('cb-silence-1', 'Disk full');
		const callback = (await createCallback(baseCallback('/silence', ['silenced', 'owner_assigned']))).body
			.data as AlertCallbackWithSecret;

		const before = Date.now();
		const res = await auth(app.patch('/api/v1/alerts/cb-silence-1/silence')).send({ silencedUntil: null });
		const responded = Date.now();
		expect(res.status).toBe(200);

		await waitFor(() => received.length >= 2, 'silenced + owner_assigned callbacks');
		expect(received.map((r) => r.headers['x-opsimate-event'])).toEqual(['silenced', 'owner_assigned']);

		const silenced = received[0];
		expect(silenced.path).toBe('/silence');
		expect(silenced.method).toBe('POST');
		expect(silenced.headers['content-type']).toBe('application/json');
		expect(silenced.headers['x-opsimate-signature']).toBe(
			signCallback(callback.secret, Number(silenced.headers['x-opsimate-timestamp']), silenced.body)
		);
		// The row was already silenced when the receiver saw the request.
		expect(silenced.silencedInDbOnArrival).toBe(true);
		expect(silenced.receivedAt).toBeGreaterThanOrEqual(before);

		const payload = payloadOf(silenced);
		expect(payload.event).toBe('silenced');
		expect(payload.bulk).toBe(false);
		expect(payload.actor).toEqual({ id: '1', name: 'Provider User' });
		expect(payload.alerts).toHaveLength(1);
		expect(payload.alerts[0].id).toBe('cb-silence-1');
		expect(payload.alerts[0].alertName).toBe('Disk full');
		expect(payload.alerts[0].isSilenced).toBe(true);
		expect(payload.details).toEqual({ silencedUntil: null });

		// The silence also assigned the alert to whoever silenced it: that's its own event.
		const assigned = payloadOf(received[1]);
		expect(assigned.details).toEqual({ ownerId: '1', ownerName: 'Provider User' });
		expect(assigned.alerts[0].ownerId).toBe('1');

		// Timing is a weak signal, but the response must not have waited for the receiver.
		expect(responded - before).toBeLessThan(2_000);

		await waitFor(
			() =>
				(
					db
						.prepare('SELECT last_status FROM alert_callbacks WHERE id = ?')
						.get(callback.id) as CallbackStatusRow
				).last_status === 'success',
			'delivery status'
		);
		const stored = (await auth(app.get(`/api/v1/callbacks/${callback.id}`))).body.data as AlertCallback;
		expect(stored.lastStatus).toBe('success');
		expect(stored.lastError).toBeNull();
		expect(stored.lastSentAt).toBeTruthy();
	});

	test('a disabled callback and a callback on another event stay silent', async () => {
		insertAlert('cb-silence-2', 'Quiet');
		await createCallback(baseCallback('/on', ['silenced']));
		await createCallback(baseCallback('/off', ['silenced'], { enabled: false }));
		await createCallback(baseCallback('/other', ['resolved']));

		expect(
			(await auth(app.patch('/api/v1/alerts/cb-silence-2/silence')).send({ silencedUntil: null })).status
		).toBe(200);
		await waitFor(() => received.some((r) => r.path === '/on'), 'the enabled callback');
		// Give any stray delivery a moment to show up before asserting it did not.
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(received.map((r) => r.path)).toEqual(['/on']);
	});

	test('a bulk resolve is ONE request carrying every alert', async () => {
		for (const id of ['cb-bulk-1', 'cb-bulk-2', 'cb-bulk-3']) insertAlert(id, `Bulk ${id}`);
		await createCallback(baseCallback('/bulk', ['resolved', 'silenced']));

		const res = await auth(app.post('/api/v1/alerts/bulk')).send({
			action: 'resolve',
			ids: ['cb-bulk-1', 'cb-bulk-2', 'cb-bulk-3'],
		});
		expect(res.status).toBe(200);
		expect(res.body.data).toEqual({ matched: 3, succeeded: 3, failed: 0 });

		await waitFor(() => received.length >= 1, 'bulk callback');
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(received).toHaveLength(1);
		const payload = payloadOf(received[0]);
		expect(payload.event).toBe('resolved');
		expect(payload.bulk).toBe(true);
		expect(payload.alerts.map((a) => a.id).sort()).toEqual(['cb-bulk-1', 'cb-bulk-2', 'cb-bulk-3']);
		expect(payload.alerts.every((a) => a.status === AlertStatus.RESOLVED)).toBe(true);
		expect(payload.actor.name).toBe('Provider User');
	});

	test('a comment fires with the alert looked up by id; deleting a resolved alert sends its last snapshot', async () => {
		insertAlert('cb-comment-1', 'Commented');
		await createCallback(baseCallback('/life', ['comment_added', 'resolved', 'deleted']));

		const comment = await auth(app.post('/api/v1/alerts/cb-comment-1/comments')).send({ comment: 'on it' });
		expect(comment.status).toBe(201);
		await waitFor(() => received.length >= 1, 'comment callback');
		const commented = payloadOf(received[0]);
		expect(commented.event).toBe('comment_added');
		expect(commented.alerts[0].alertName).toBe('Commented');
		expect(commented.details).toEqual({ comment: 'on it' });
		expect(commented.actor).toEqual({ id: '1', name: 'Provider User' });

		expect((await auth(app.delete('/api/v1/alerts/cb-comment-1'))).status).toBe(200);
		await waitFor(() => received.length >= 2, 'resolved callback');

		expect((await auth(app.delete('/api/v1/alerts/resolved/cb-comment-1'))).status).toBe(200);
		await waitFor(() => received.length >= 3, 'deleted callback');
		const deleted = payloadOf(received[2]);
		expect(deleted.event).toBe('deleted');
		expect(deleted.alerts[0].id).toBe('cb-comment-1');
		expect(deleted.alerts[0].status).toBe('resolved');
		expect(deleted.actor.name).toBe('Provider User');
		expect(db.prepare('SELECT 1 FROM alerts_resolved WHERE id = ?').get('cb-comment-1')).toBeUndefined();
	});

	test('the deprecated sender resolve (DELETE with the API token) fires nothing; a user resolve does', async () => {
		insertAlert('cb-sender-1', 'Sender resolved');
		insertAlert('cb-user-1', 'User resolved');
		await createCallback(baseCallback('/resolve', ['resolved']));

		// A webhook sender reporting recovery through the old route: a source-reported
		// recovery, which never fires a callback.
		const bySender = await app
			.delete('/api/v1/alerts/cb-sender-1')
			.set('x-api-token', process.env.API_TOKEN ?? 'opsimate');
		expect(bySender.status).toBe(200);
		expect(db.prepare('SELECT 1 FROM alerts_resolved WHERE id = ?').get('cb-sender-1')).toBeTruthy();

		expect((await auth(app.delete('/api/v1/alerts/cb-user-1'))).status).toBe(200);
		await waitFor(() => received.length >= 1, 'user resolve callback');
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(received.map((r) => payloadOf(r).alerts[0].id)).toEqual(['cb-user-1']);
	});

	test('running an action on an alert fires action_run after the action itself', async () => {
		insertAlert('cb-action-1', 'Acted on');
		await createCallback(baseCallback('/cb', ['action_run']));
		const action = await auth(app.post('/api/v1/actions')).send({
			name: 'Ping receiver',
			type: 'http',
			config: { url: `${receiverUrl}/action`, method: 'POST', bodyTemplate: '{"alert":"{{name}}"}' },
		});
		expect(action.status).toBe(201);

		const run = await auth(app.post(`/api/v1/actions/${action.body.data.id}/run`)).send({
			alert: { id: 'cb-action-1', alertName: 'Acted on' },
		});
		expect(run.status).toBe(200);
		expect(run.body.data.ok).toBe(true);

		await waitFor(() => received.length >= 2, 'action + callback');
		expect(received.map((r) => r.path)).toEqual(['/action', '/cb']);
		const payload = payloadOf(received[1]);
		expect(payload.event).toBe('action_run');
		expect(payload.alerts[0].alertName).toBe('Acted on');
		expect(payload.details).toEqual({ actionName: 'Ping receiver' });
		expect(payload.actor).toEqual({ id: '1', name: 'Provider User' });
	});

	test('a body template replaces the JSON payload', async () => {
		insertAlert('cb-tpl-1', 'Templated');
		await createCallback(
			baseCallback('/tpl', ['unsilenced'], {
				method: 'PUT',
				headers: { 'X-Token': 'abc' },
				bodyTemplate: 'event={{event}} alert={{name}} by={{actor.name}} n={{count}}',
			})
		);
		await auth(app.patch('/api/v1/alerts/cb-tpl-1/silence')).send({ silencedUntil: null });
		expect((await auth(app.patch('/api/v1/alerts/cb-tpl-1/unsilence'))).status).toBe(200);

		await waitFor(() => received.length >= 1, 'templated callback');
		expect(received[0].method).toBe('PUT');
		expect(received[0].headers['x-token']).toBe('abc');
		expect(received[0].body).toBe('event=unsilenced alert=Templated by=Provider User n=1');
	});

	// Every event in ALERT_CALLBACK_EVENTS, triggered through the API in one alert's life,
	// against a callback subscribed to all of them. Adding an event to the list without a
	// trigger here fails the exhaustiveness check at the end.
	test('every callback event fires through the API, in order, signed, with its own delivery id', async () => {
		insertAlert('cb-all-1', 'Everything');
		const callback = (await createCallback(baseCallback('/all', [...ALERT_CALLBACK_EVENTS]))).body
			.data as AlertCallbackWithSecret;
		const action = await auth(app.post('/api/v1/actions')).send({
			name: 'Ping',
			type: 'http',
			config: { url: `${receiverUrl}/action-side-effect`, method: 'POST' },
		});
		expect(action.status).toBe(201);
		const actionId = action.body.data.id as number;

		const steps: LifecycleStep[] = [
			{
				run: () => auth(app.patch('/api/v1/alerts/cb-all-1/owner')).send({ ownerId: '1' }),
				expect: [['owner_assigned', { ownerId: '1', ownerName: 'Provider User' }]],
			},
			{
				run: () => auth(app.patch('/api/v1/alerts/cb-all-1/owner')).send({ ownerId: null }),
				expect: [['owner_unassigned', { ownerId: null, ownerName: null }]],
			},
			{
				// Silencing also hands the alert to whoever silenced it.
				run: () => auth(app.patch('/api/v1/alerts/cb-all-1/silence')).send({ silencedUntil: null }),
				expect: [
					['silenced', { silencedUntil: null }],
					['owner_assigned', { ownerId: '1', ownerName: 'Provider User' }],
				],
			},
			{ run: () => auth(app.patch('/api/v1/alerts/cb-all-1/unsilence')), expect: [['unsilenced', {}]] },
			{
				run: () => auth(app.post('/api/v1/alerts/cb-all-1/comments')).send({ comment: 'looking' }),
				expect: [['comment_added', { comment: 'looking' }]],
			},
			{
				run: () =>
					auth(app.post(`/api/v1/actions/${actionId}/run`)).send({
						alert: { id: 'cb-all-1', alertName: 'Everything' },
					}),
				expect: [['action_run', { actionName: 'Ping' }]],
			},
			{ run: () => auth(app.delete('/api/v1/alerts/cb-all-1')), expect: [['resolved', { comment: null }]] },
			{
				run: () => auth(app.patch('/api/v1/alerts/resolved/cb-all-1/unresolve')),
				expect: [['unresolved', {}]],
			},
			{ run: () => auth(app.delete('/api/v1/alerts/cb-all-1')), expect: [['resolved', { comment: null }]] },
			{ run: () => auth(app.delete('/api/v1/alerts/resolved/cb-all-1')), expect: [['deleted', {}]] },
		];

		const expected: ExpectedEvent[] = [];
		for (const [i, step] of steps.entries()) {
			const res = await step.run();
			expect(res.status, `step ${i + 1} (${step.expect.map(([event]) => event).join(', ')})`).toBeLessThan(300);
			expected.push(...step.expect);
		}
		const deliveries = () => received.filter((r) => r.path === '/all');
		await waitFor(() => deliveries().length >= expected.length, 'every callback event');
		await new Promise((resolve) => setTimeout(resolve, 100));
		const all = deliveries();
		expect(all).toHaveLength(expected.length);

		// Order, payload and transport, request by request.
		const payloads = all.map(payloadOf);
		expect(payloads.map((p) => [p.event, p.details])).toEqual(expected);
		const ids = new Set<string>();
		for (const [i, request] of all.entries()) {
			const payload = payloads[i];
			expect(request.method).toBe('POST');
			expect(request.headers['content-type']).toBe('application/json');
			expect(request.headers['x-opsimate-event']).toBe(payload.event);
			expect(request.headers['x-opsimate-signature']).toBe(
				signCallback(callback.secret, Number(request.headers['x-opsimate-timestamp']), request.body)
			);
			expect(Math.abs(Number(request.headers['x-opsimate-timestamp']) * 1000 - Date.now())).toBeLessThan(60_000);
			ids.add(request.headers['x-opsimate-delivery'] as string);
			expect(payload.bulk).toBe(false);
			expect(payload.actor).toEqual({ id: '1', name: 'Provider User' });
			expect(payload.alerts.map((a) => a.id)).toEqual(['cb-all-1']);
			expect(Date.parse(payload.timestamp)).not.toBeNaN();
		}
		// Each delivery has its own id (retries would share one, see the dispatcher tests).
		expect(ids.size).toBe(all.length);

		// The alert's state travels with each event.
		const byEvent = (event: AlertCallbackEvent) => payloads.filter((p) => p.event === event);
		expect(byEvent('silenced')[0].alerts[0].isSilenced).toBe(true);
		expect(byEvent('unsilenced')[0].alerts[0].isSilenced).toBe(false);
		expect(byEvent('owner_assigned').map((p) => p.alerts[0].ownerId)).toEqual(['1', '1']);
		expect(byEvent('owner_unassigned')[0].alerts[0].ownerId ?? null).toBeNull();
		expect(byEvent('resolved').every((p) => p.alerts[0].status === AlertStatus.RESOLVED)).toBe(true);
		expect(byEvent('unresolved')[0].alerts[0].status).toBe(AlertStatus.FIRING);
		expect(byEvent('deleted')[0].alerts[0].status).toBe(AlertStatus.RESOLVED);

		// Exhaustiveness: nothing in ALERT_CALLBACK_EVENTS went untested.
		expect([...new Set(payloads.map((p) => p.event))].sort()).toEqual([...ALERT_CALLBACK_EVENTS].sort());
	});
});
