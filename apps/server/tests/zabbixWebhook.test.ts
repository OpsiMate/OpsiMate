import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { Alert, AlertStatus } from '@OpsiMate/shared';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// The Zabbix media-type webhook. Zabbix's "Test" button sends no event/trigger id and
// gets a placeholder alert; problem events fire (or update) `ZABBIX_<event id>`;
// recovery events resolve it; event_tags, severity and host details become tags; and
// the handler builds the deep link back to the Zabbix event.

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

interface AlertLookupBody {
	data: { alert: Alert; resolved: boolean };
}
interface AlertListBody {
	data: { alerts: Alert[] };
}

const post = (body: Record<string, unknown>) =>
	app.post('/api/v1/alerts/custom/zabbix').set('Authorization', `Bearer ${jwtToken}`).send(body);

const lookup = async (id: string) => {
	const res = await app.get(`/api/v1/alerts/${encodeURIComponent(id)}`).set('Authorization', `Bearer ${jwtToken}`);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return (res.body as AlertLookupBody).data;
};

const listAlerts = async (): Promise<Alert[]> => {
	const res = await app.get('/api/v1/alerts?limit=100').set('Authorization', `Bearer ${jwtToken}`);
	expect(res.status).toBe(200);
	return (res.body as AlertListBody).data.alerts;
};

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

afterAll(() => db.close());

beforeEach(() => {
	db.exec('DELETE FROM alerts');
	db.exec('DELETE FROM alerts_resolved');
});

describe('POST /api/v1/alerts/custom/zabbix', () => {
	test('a body without event_id or trigger_id is the Zabbix test button: 200 and a "Test Alert" row', async () => {
		const res = await post({ host_name: 'zabbix-test-host' });

		expect(res.status).toBe(200);
		expect(res.body).toEqual({ success: true, data: null });

		const testAlert = (await listAlerts()).find((alert) => alert.alertName === 'Test Alert');
		expect(testAlert).toBeDefined();
		expect(testAlert?.type).toBe('Zabbix');
		expect(testAlert?.status).toBe(AlertStatus.FIRING);
		expect(testAlert?.summary).toBe('Test Alert from Zabbix was created successfully');
	});

	test('event_value "0" resolves the alert and responds { alertId, resolved: true }', async () => {
		const firing = await post({
			event_id: '5001',
			trigger_id: '71',
			trigger_name: 'Disk full',
			host_name: 'db-1',
			item_value: '92%',
			event_value: '1',
		});
		expect(firing.status).toBe(200);
		expect(firing.body.data).toMatchObject({ alertId: 'ZABBIX_5001', updated: true });

		const fired = await lookup('ZABBIX_5001');
		expect(fired.resolved).toBe(false);
		expect(fired.alert.type).toBe('Zabbix');
		expect(fired.alert.status).toBe(AlertStatus.FIRING);
		expect(fired.alert.alertName).toBe('Disk full');
		expect(fired.alert.summary).toBe('Disk full on db-1 - Value: 92%');

		const recovery = await post({ event_id: '5001', event_value: '0' });
		expect(recovery.status).toBe(200);
		expect(recovery.body.data).toEqual({ alertId: 'ZABBIX_5001', resolved: true });
		expect((await lookup('ZABBIX_5001')).resolved).toBe(true);
	});

	test('trigger_status "ok" / "OK" also resolves', async () => {
		for (const [eventId, status] of [
			['5002', 'ok'],
			['5012', 'OK'],
		] as const) {
			await post({ event_id: eventId, trigger_id: '72', trigger_name: 'CPU high', trigger_status: 'PROBLEM' });

			const recovery = await post({ event_id: eventId, trigger_status: status });
			expect(recovery.status).toBe(200);
			expect(recovery.body.data).toEqual({ alertId: `ZABBIX_${eventId}`, resolved: true });
			expect((await lookup(`ZABBIX_${eventId}`)).resolved).toBe(true);
		}
	});

	test('unexpanded recovery macros do not resolve a problem event', async () => {
		const res = await post({
			event_id: '5003',
			trigger_id: '73',
			trigger_name: 'Memory high',
			event_value: '1',
			trigger_status: 'PROBLEM',
			event_recovery_date: '{EVENT.RECOVERY.DATE}',
			event_recovery_time: '{EVENT.RECOVERY.TIME}',
		});

		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({ alertId: 'ZABBIX_5003', updated: true });
		expect(res.body.data.resolved).toBeUndefined();
		expect((await lookup('ZABBIX_5003')).resolved).toBe(false);
	});

	test('a real event_recovery_date + event_recovery_time resolves', async () => {
		await post({ event_id: '5009', trigger_id: '79', trigger_name: 'Backup failed', event_value: '1' });

		const recovery = await post({
			event_id: '5009',
			event_recovery_date: '2026-11-06',
			event_recovery_time: '12:00:00',
		});
		expect(recovery.status).toBe(200);
		expect(recovery.body.data).toEqual({ alertId: 'ZABBIX_5009', resolved: true });
		expect((await lookup('ZABBIX_5009')).resolved).toBe(true);
	});

	test('blank recovery date/time do not resolve', async () => {
		const res = await post({
			event_id: '5010',
			trigger_id: '80',
			trigger_name: 'Swap high',
			event_value: '1',
			trigger_status: 'PROBLEM',
			event_recovery_date: '   ',
			event_recovery_time: '',
		});

		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({ alertId: 'ZABBIX_5010', updated: true });
		expect((await lookup('ZABBIX_5010')).resolved).toBe(false);
	});

	test('event_tags are trimmed into tags, and severity / host / host_ip are added', async () => {
		const res = await post({
			event_id: '5004',
			trigger_id: '74',
			event_tags: ' env: prod , flag , region : eu ',
			trigger_severity: 'Warning',
			host_name: 'web-1',
			host_ip: '10.0.0.5',
		});
		expect(res.status).toBe(200);

		const { alert } = await lookup('ZABBIX_5004');
		expect(alert.tags).toEqual({
			env: 'prod',
			flag: 'true',
			region: 'eu',
			severity: 'warning',
			host: 'web-1',
			host_ip: '10.0.0.5',
		});

		// A payload without event_tags still carries the severity and host tags.
		await post({ event_id: '5011', trigger_id: '81', trigger_severity: 'High', host_name: 'web-2' });
		const second = await lookup('ZABBIX_5011');
		expect(second.alert.tags).toEqual({ severity: 'critical', host: 'web-2' });
	});

	test('trigger_url wins over zabbix_url', async () => {
		await post({
			event_id: '5005',
			trigger_id: '75',
			trigger_url: 'https://zabbix.example.com/triggers/75',
			zabbix_url: 'https://zabbix.example.com',
		});

		const { alert } = await lookup('ZABBIX_5005');
		expect(alert.alertUrl).toBe('https://zabbix.example.com/triggers/75');
	});

	test('a zabbix_url with a trailing slash still builds the tr_events deep link', async () => {
		await post({ event_id: '5006', trigger_id: '76', zabbix_url: 'https://zabbix.example.com/' });

		const { alert } = await lookup('ZABBIX_5006');
		expect(alert.alertUrl).toBe('https://zabbix.example.com/tr_events.php?triggerid=76&eventid=5006');
	});

	test('an unexpanded trigger_url macro is ignored', async () => {
		await post({
			event_id: '5007',
			trigger_id: '77',
			trigger_url: '{TRIGGER.URL}',
			zabbix_url: 'https://zabbix.example.com',
		});
		expect((await lookup('ZABBIX_5007')).alert.alertUrl).toBe(
			'https://zabbix.example.com/tr_events.php?triggerid=77&eventid=5007'
		);

		// No usable URL at all: the alert is still accepted, just without a link.
		await post({ event_id: '5008', trigger_id: '78', trigger_url: '{TRIGGER.URL}' });
		expect((await lookup('ZABBIX_5008')).alert.alertUrl).toBe('');
	});

	test('without an event_id the alert id falls back to the trigger id', async () => {
		const res = await post({ trigger_id: '88', trigger_name: 'Interface down' });

		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({ alertId: 'ZABBIX_88', updated: true });
		const { alert } = await lookup('ZABBIX_88');
		expect(alert.alertName).toBe('Interface down');
	});

	test('alert_message wins over the composed summary', async () => {
		await post({
			event_id: '5014',
			trigger_id: '82',
			trigger_name: 'CPU',
			host_name: 'app-1',
			alert_message: 'Zabbix: CPU above 90%',
		});

		const { alert } = await lookup('ZABBIX_5014');
		expect(alert.summary).toBe('Zabbix: CPU above 90%');
	});

	test('a non-string field is a 400 and creates no alert', async () => {
		const res = await post({ event_id: 5 });

		expect(res.status).toBe(400);
		expect(res.body).toMatchObject({ success: false, error: 'Validation error' });
		expect(await listAlerts()).toEqual([]);
	});

	test('the route stays behind auth: no token is a 401 and creates nothing', async () => {
		const res = await app.post('/api/v1/alerts/custom/zabbix').send({ event_id: '5015' });

		expect(res.status).toBe(401);
		expect(await listAlerts()).toEqual([]);
	});
});
