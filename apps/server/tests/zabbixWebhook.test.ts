import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, test } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// POST /alerts/custom/zabbix takes whatever the Zabbix media type sends. The interesting
// parts are the ones a misconfigured media type quietly breaks: the test-alert path (no
// ids at all), the three ways Zabbix reports a recovery, the tag string, and the alert
// URL, which prefers {TRIGGER.URL} but must not paste an unexpanded macro into the link.

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

interface AlertRow {
	id: string;
	status: string;
	type: string;
	tags: string;
	alert_url: string;
	alert_name: string;
	summary: string;
}

const post = (body: Record<string, unknown>) =>
	app.post('/api/v1/alerts/custom/zabbix').set('Authorization', `Bearer ${jwtToken}`).send(body);

const alertRow = (id: string) => db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as AlertRow | undefined;
const resolvedRow = (id: string) =>
	db.prepare('SELECT * FROM alerts_resolved WHERE id = ?').get(id) as AlertRow | undefined;
const tagsOf = (id: string) => JSON.parse(alertRow(id)?.tags ?? '{}') as Record<string, string>;

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

describe('POST /alerts/custom/zabbix — test alert', () => {
	test('a body without event_id and trigger_id stores the Test Alert row and answers 200', async () => {
		const res = await post({ trigger_name: '{TRIGGER.NAME}', host_name: '{HOST.NAME}' });

		expect(res.status).toBe(200);
		expect(res.body).toEqual({ success: true, data: null });

		const row = db.prepare("SELECT * FROM alerts WHERE alert_name = 'Test Alert'").get() as AlertRow | undefined;
		expect(row).toBeDefined();
		expect(row?.type).toBe('Zabbix');
		expect(row?.status).toBe('firing');
		expect(row?.summary).toBe('Test Alert from Zabbix was created successfully');
	});

	test('a body with only a trigger_id is not a test alert', async () => {
		const res = await post({ trigger_id: '77', trigger_name: 'real alert' });

		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({ alertId: 'ZABBIX_77' });
		expect(alertRow('ZABBIX_77')?.alert_name).toBe('real alert');
	});
});

describe('POST /alerts/custom/zabbix — recovery detection', () => {
	test('event_value "0" resolves and reports resolved: true', async () => {
		await post({ event_id: 'rec-1', trigger_id: '10', trigger_name: 'disk full' });

		const res = await post({ event_id: 'rec-1', trigger_id: '10', event_value: '0' });

		expect(res.status).toBe(200);
		expect(res.body.data).toEqual({ alertId: 'ZABBIX_rec-1', resolved: true });
		expect(alertRow('ZABBIX_rec-1')).toBeUndefined();
		expect(resolvedRow('ZABBIX_rec-1')).toBeDefined();
	});

	test('trigger_status "ok" resolves regardless of casing', async () => {
		await post({ event_id: 'rec-2', trigger_name: 'cpu high' });
		const lower = await post({ event_id: 'rec-2', trigger_status: 'ok' });
		expect(lower.body.data).toEqual({ alertId: 'ZABBIX_rec-2', resolved: true });

		await post({ event_id: 'rec-3', trigger_name: 'cpu high' });
		const upper = await post({ event_id: 'rec-3', trigger_status: 'OK' });
		expect(upper.body.data).toEqual({ alertId: 'ZABBIX_rec-3', resolved: true });
	});

	test('unexpanded recovery macros do not count as a recovery', async () => {
		await post({ event_id: 'rec-4', trigger_name: 'still firing' });

		const res = await post({
			event_id: 'rec-4',
			trigger_name: 'still firing',
			event_recovery_date: '{EVENT.RECOVERY.DATE}',
			event_recovery_time: '{EVENT.RECOVERY.TIME}',
		});

		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({ alertId: 'ZABBIX_rec-4' });
		expect(res.body.data).not.toHaveProperty('resolved', true);
		expect(alertRow('ZABBIX_rec-4')?.status).toBe('firing');
	});

	test('a real recovery date and time do resolve', async () => {
		await post({ event_id: 'rec-5', trigger_name: 'back to normal' });

		const res = await post({
			event_id: 'rec-5',
			event_recovery_date: '2026-11-06',
			event_recovery_time: '10:00:00',
		});

		expect(res.body.data).toEqual({ alertId: 'ZABBIX_rec-5', resolved: true });
	});

	test('an empty recovery date and time does not resolve', async () => {
		await post({ event_id: 'rec-6', trigger_name: 'blank macros' });

		const res = await post({ event_id: 'rec-6', event_recovery_date: '', event_recovery_time: '   ' });

		expect(res.body.data).toMatchObject({ alertId: 'ZABBIX_rec-6' });
		expect(alertRow('ZABBIX_rec-6')?.status).toBe('firing');
	});
});

describe('POST /alerts/custom/zabbix — tags', () => {
	test('event_tags become key/value tags, flag-only entries get "true"', async () => {
		await post({
			event_id: 'tag-1',
			trigger_name: 'tagged',
			event_tags: 'env:prod,flag, region : eu ',
			trigger_severity: 'High',
			host_name: 'web-01',
			host_ip: '10.0.0.7',
		});

		// Zabbix's own severity words are mapped onto OpsiMate's levels on the way in
		// (High -> critical, Average -> warning), the other tags are passed through.
		expect(tagsOf('ZABBIX_tag-1')).toMatchObject({
			env: 'prod',
			flag: 'true',
			region: 'eu',
			severity: 'critical',
			host: 'web-01',
			host_ip: '10.0.0.7',
		});
	});

	test('a body without event_tags still carries severity and host tags', async () => {
		await post({ event_id: 'tag-2', trigger_name: 'no tags', trigger_severity: 'Average', host_name: 'db-01' });

		const tags = tagsOf('ZABBIX_tag-2');
		expect(tags.severity).toBe('warning');
		expect(tags.host).toBe('db-01');
		expect(tags.host_ip).toBeUndefined();
	});
});

describe('POST /alerts/custom/zabbix — alert URL', () => {
	test('trigger_url wins over zabbix_url when it is expanded', async () => {
		await post({
			event_id: 'url-1',
			trigger_id: '11',
			trigger_name: 'linked',
			trigger_url: 'https://zabbix.example/tr_events.php?triggerid=11&eventid=url-1',
			zabbix_url: 'https://ignored.example',
		});

		expect(alertRow('ZABBIX_url-1')?.alert_url).toBe(
			'https://zabbix.example/tr_events.php?triggerid=11&eventid=url-1'
		);
	});

	test('zabbix_url builds the tr_events link and drops a trailing slash', async () => {
		await post({ event_id: 'url-2', trigger_id: '22', trigger_name: 'built', zabbix_url: 'https://zbx.example/' });

		expect(alertRow('ZABBIX_url-2')?.alert_url).toBe(
			'https://zbx.example/tr_events.php?triggerid=22&eventid=url-2'
		);
	});

	test('an unexpanded trigger_url falls back to the zabbix_url link', async () => {
		await post({
			event_id: 'url-3',
			trigger_id: '33',
			trigger_name: 'macro',
			trigger_url: '{TRIGGER.URL}',
			zabbix_url: 'https://zbx.example',
		});

		expect(alertRow('ZABBIX_url-3')?.alert_url).toBe(
			'https://zbx.example/tr_events.php?triggerid=33&eventid=url-3'
		);
	});

	test('no usable url leaves alert_url empty', async () => {
		await post({ event_id: 'url-4', trigger_name: 'bare' });

		expect(alertRow('ZABBIX_url-4')?.alert_url).toBe('');
	});
});

describe('POST /alerts/custom/zabbix — validation', () => {
	test('a non-string event_id is rejected with 400', async () => {
		const res = await post({ event_id: 5, trigger_name: 'number id' });

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(res.body.error).toBe('Validation error');
	});

	test('an unauthenticated request is rejected with 401', async () => {
		const res = await app.post('/api/v1/alerts/custom/zabbix').send({ event_id: 'no-auth' });

		expect(res.status).toBe(401);
	});
});
