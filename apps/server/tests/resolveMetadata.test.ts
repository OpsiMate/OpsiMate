import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { Alert } from '@OpsiMate/shared';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// #1159: a resolve POST that carries the alert's metadata (name, summary, tags, ...)
// stores that metadata on the resolved alert, the same fields a firing update would
// rewrite. Fields the resolve leaves out keep what the alert had while firing, and an
// id-only resolve changes nothing but the status.

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

interface AlertList {
	alerts: Alert[];
}

interface AlertListBody {
	data: AlertList;
}

interface ResolveResult {
	alertId: string;
	status: string;
	resolved: boolean;
	created: boolean;
}

interface ResolveBody {
	data: ResolveResult;
}

const auth = () => `Bearer ${jwtToken}`;
const postCustom = (body: Record<string, unknown>) =>
	app.post('/api/v1/alerts/custom').set('Authorization', auth()).send(body);
const postGrafana = (body: Record<string, unknown>) =>
	app.post('/api/v1/alerts/custom/grafana').set('Authorization', auth()).send(body);

const findIn = async (path: string, id: string): Promise<Alert | undefined> => {
	const res = await app.get(`${path}?limit=500`).set('Authorization', auth());
	return (res.body as AlertListBody).data.alerts.find((a) => a.id === id);
};
const activeAlert = async (id: string): Promise<Alert> => {
	const alert = await findIn('/api/v1/alerts', id);
	if (!alert) throw new Error(`alert ${id} is not firing`);
	return alert;
};
const resolvedAlert = async (id: string): Promise<Alert> => {
	const alert = await findIn('/api/v1/alerts/resolved', id);
	if (!alert) throw new Error(`alert ${id} is not resolved`);
	return alert;
};

const firing = {
	alertName: 'Disk almost full',
	summary: 'Disk at 91%',
	tags: { env: 'staging', host: 'db-1' },
	severity: 'warning',
	team: 'storage',
	runbookUrl: 'https://runbooks.example.com/disk',
	links: [{ label: 'Dashboard', url: 'https://grafana.example.com/d/disk' }],
	startsAt: '2026-10-01T10:00:00.000Z',
};

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

afterAll(() => {
	db.close();
});

describe('POST /alerts/custom resolve with metadata', () => {
	test('the metadata sent with the resolve is stored on the resolved alert', async () => {
		await postCustom({ id: 'm-full', ...firing });

		const res = await postCustom({
			id: 'm-full',
			status: 'resolved',
			alertName: 'Disk usage back to normal',
			summary: 'Disk at 40% after cleanup',
			tags: { env: 'production', host: 'db-1', region: 'eu' },
			severity: 'critical',
			team: 'platform',
			runbookUrl: 'https://runbooks.example.com/disk-v2',
			links: [{ label: 'Postmortem', url: 'https://wiki.example.com/pm/42' }],
		});
		expect(res.status).toBe(200);
		expect((res.body as ResolveBody).data).toEqual({
			alertId: 'm-full',
			status: 'resolved',
			resolved: true,
			created: false,
		});

		const alert = await resolvedAlert('m-full');
		expect(alert.status).toBe('resolved');
		expect(alert.alertName).toBe('Disk usage back to normal');
		expect(alert.summary).toBe('Disk at 40% after cleanup');
		expect(alert.tags).toMatchObject({ env: 'production', host: 'db-1', region: 'eu' });
		expect(alert.severity).toBe('critical');
		expect(alert.team).toBe('platform');
		expect(alert.runbookUrl).toBe('https://runbooks.example.com/disk-v2');
		expect(alert.links).toEqual([
			expect.objectContaining({ label: 'Postmortem', url: 'https://wiki.example.com/pm/42' }),
		]);
	});

	test('the start time and owner are kept: a resolve ends the episode, it does not restart it', async () => {
		await postCustom({ id: 'm-owner', ...firing });
		const owned = await app
			.patch('/api/v1/alerts/m-owner/owner')
			.set('Authorization', auth())
			.send({ ownerId: '1' });
		expect(owned.status).toBe(200);
		const before = await activeAlert('m-owner');

		await postCustom({
			id: 'm-owner',
			status: 'resolved',
			alertName: 'renamed',
			tags: {},
			startsAt: '2026-10-05T00:00:00.000Z',
		});

		const alert = await resolvedAlert('m-owner');
		expect(alert.alertName).toBe('renamed');
		expect(alert.startsAt).toBe(before.startsAt);
		expect(alert.ownerId).toBe('1');
	});

	test('fields the resolve leaves out keep their firing values; the tags sent replace the old ones', async () => {
		await postCustom({ id: 'm-lean', ...firing });

		await postCustom({ id: 'm-lean', status: 'resolved', alertName: 'Disk almost full', tags: { env: 'staging' } });

		const alert = await resolvedAlert('m-lean');
		expect(alert.summary).toBe('Disk at 91%');
		expect(alert.severity).toBe('warning');
		expect(alert.team).toBe('storage');
		expect(alert.runbookUrl).toBe('https://runbooks.example.com/disk');
		expect(alert.links).toEqual([
			expect.objectContaining({ label: 'Dashboard', url: 'https://grafana.example.com/d/disk' }),
		]);
		expect(alert.tags).toMatchObject({ env: 'staging' });
		expect(alert.tags).not.toHaveProperty('host');
	});

	test('severity and team sent as tags count as sent', async () => {
		await postCustom({ id: 'm-tags', ...firing });

		await postCustom({
			id: 'm-tags',
			status: 'resolved',
			alertName: 'Disk almost full',
			tags: { severity: 'crit', team: 'sre' },
		});

		const alert = await resolvedAlert('m-tags');
		expect(alert.severity).toBe('critical');
		expect(alert.team).toBe('sre');
	});

	test('an id-only resolve keeps every field the alert had while firing', async () => {
		await postCustom({ id: 'm-id-only', ...firing });
		const before = await activeAlert('m-id-only');

		await postCustom({ id: 'm-id-only', status: 'resolved' });

		const alert = await resolvedAlert('m-id-only');
		expect(alert.alertName).toBe(before.alertName);
		expect(alert.summary).toBe(before.summary);
		expect(alert.tags).toEqual(before.tags);
		expect(alert.severity).toBe(before.severity);
		expect(alert.team).toBe(before.team);
		expect(alert.runbookUrl).toBe(before.runbookUrl);
		expect(alert.links).toEqual(before.links);
		expect(alert.startsAt).toBe(before.startsAt);
	});

	test('the manual resolve (DELETE) is unchanged', async () => {
		await postCustom({ id: 'm-delete', ...firing });

		const res = await app.delete('/api/v1/alerts/m-delete').set('Authorization', auth());
		expect(res.status).toBe(200);

		const alert = await resolvedAlert('m-delete');
		expect(alert.alertName).toBe('Disk almost full');
		expect(alert.summary).toBe('Disk at 91%');
	});
});

describe('POST /alerts/custom/grafana resolve with metadata', () => {
	const grafanaAlert = (status: string, summary: string) => ({
		alerts: [
			{
				status,
				fingerprint: 'g-meta',
				labels: { alertname: 'High latency', service: 'checkout' },
				annotations: { summary },
				startsAt: '2026-10-01T10:00:00.000Z',
			},
		],
	});

	test('the summary Grafana sends with the resolve replaces the firing one', async () => {
		await postGrafana(grafanaAlert('firing', 'p99 latency 2.4s'));
		expect((await activeAlert('g-meta')).summary).toBe('p99 latency 2.4s');

		await postGrafana(grafanaAlert('resolved', 'p99 latency back to 180ms'));

		const alert = await resolvedAlert('g-meta');
		expect(alert.summary).toBe('p99 latency back to 180ms');
		expect(alert.alertName).toBe('High latency');
	});
});
