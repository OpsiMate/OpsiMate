import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { AlertType, IntegrationType } from '@OpsiMate/shared';
import { AlertBL } from '../src/bl/alerts/alert.bl';
import { AlertRepository } from '../src/dal/alertRepository';
import { AlertCommentsRepository } from '../src/dal/alertCommentsRepository';
import { AlertHistoryRepository } from '../src/dal/alertHistoryRepository';
import { ResolvedAlertRepository } from '../src/dal/resolvedAlertRepository';
import { UserRepository } from '../src/dal/userRepository';
import { alertsResolvedTotal } from '../src/metrics';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// Deleting the integration a source pushes through is the last chance its open alerts
// get at a resolution: no future webhook will ever report them as recovered. So
// `IntegrationBL.deleteIntegration` hands the connector the alert BL, the Grafana
// connector resolves everything of its type, and the others resolve nothing. These
// tests pin both halves — which alerts move, and that the auto-resolution counter
// counts exactly the moves and never a non-event.

let db: Database.Database;
let app: SuperTest<Test>;
let jwtToken: string;
let alertRepo: AlertRepository;
let bl: AlertBL;

interface IdRow {
	id: string;
}

interface ResolvedRow extends IdRow {
	status: string;
	archived_at: string | null;
}

const insertAlert = (id: string, type: AlertType) => {
	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO alerts (id, status, type, tags, starts_at, updated_at, alert_url, alert_name, is_dismissed)
		 VALUES (?, 'firing', ?, '{}', ?, ?, ?, ?, 0)`
	).run(id, type, now, now, `https://example.com/${id}`, `alert ${id}`);
};

const activeIds = () => (db.prepare('SELECT id FROM alerts ORDER BY id').all() as IdRow[]).map((row) => row.id);
const resolvedIds = () =>
	(db.prepare('SELECT id FROM alerts_resolved ORDER BY id').all() as IdRow[]).map((row) => row.id);
const integrationNames = () =>
	(db.prepare('SELECT name FROM integrations ORDER BY id').all() as { name: string }[]).map((row) => row.name);
const selectedIds = async (activeAlertIds: Set<string>, alertType: AlertType) =>
	(await alertRepo.getAlertsNotInIds(activeAlertIds, alertType)).map((alert) => alert.id).sort();

const createIntegration = async (type: IntegrationType): Promise<number> => {
	const res = await app
		.post('/api/v1/integrations')
		.set('Authorization', `Bearer ${jwtToken}`)
		.send({
			name: `${type} integration`,
			type,
			externalUrl: `https://${type.toLowerCase()}.example.com`,
			credentials: { apiKey: 'test-api-key' },
		});
	expect(res.status).toBe(201);
	return res.body.data.id as number;
};

const deleteIntegration = (integrationId: number) =>
	app.delete(`/api/v1/integrations/${integrationId}`).set('Authorization', `Bearer ${jwtToken}`);

// A module-level counter shared by every test in this file (and by the app's own
// AlertBL), so each assertion reads a baseline instead of an absolute.
const autoResolvedTotal = async (): Promise<number> => {
	const metric = await alertsResolvedTotal.get();
	return metric.values.find((value) => value.labels.mode === 'auto')?.value ?? 0;
};

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
	alertRepo = new AlertRepository(db);
	bl = new AlertBL(
		alertRepo,
		new ResolvedAlertRepository(db),
		new AlertCommentsRepository(db),
		new AlertHistoryRepository(db),
		new UserRepository(db)
	);
});

beforeEach(() => {
	db.exec('DELETE FROM alerts');
	db.exec('DELETE FROM alerts_resolved');
	db.exec('DELETE FROM integrations');
	insertAlert('g1', 'Grafana');
	insertAlert('g2', 'Grafana');
	insertAlert('c1', 'Custom');
	insertAlert('dd1', 'Datadog');
});

afterAll(() => {
	db.close();
});

describe('deleting an integration through the API', () => {
	test('a Grafana delete moves every Grafana alert out of the active table', async () => {
		const integrationId = await createIntegration(IntegrationType.Grafana);

		const res = await deleteIntegration(integrationId);
		expect(res.status).toBe(200);

		expect(activeIds()).toEqual(['c1', 'dd1']);
		expect(resolvedIds()).toEqual(['g1', 'g2']);
	});

	test('deleting one integration resolves only its own alert type', async () => {
		const grafanaId = await createIntegration(IntegrationType.Grafana);
		await createIntegration(IntegrationType.Kibana);

		await deleteIntegration(grafanaId);

		// A Custom or Datadog alert is not the Grafana source's to close: its own
		// integration is still configured and may still report a recovery.
		expect(activeIds()).toEqual(['c1', 'dd1']);
		expect(resolvedIds()).toEqual(['g1', 'g2']);
		// And the delete is scoped to that row: the other integration is untouched.
		expect(integrationNames()).toEqual(['Kibana integration']);
	});

	test('the resolved copy is closed and stamped, not just moved', async () => {
		const integrationId = await createIntegration(IntegrationType.Grafana);
		await deleteIntegration(integrationId);

		const row = db
			.prepare(`SELECT id, status, archived_at FROM alerts_resolved WHERE id = 'g1'`)
			.get() as ResolvedRow;
		expect(row.status).toBe('resolved');
		expect(row.archived_at).not.toBeNull();
	});

	test.each([IntegrationType.Kibana, IntegrationType.Datadog])(
		'deleting a %s integration touches no alert at all',
		async (type) => {
			const integrationId = await createIntegration(type);
			const res = await deleteIntegration(integrationId);
			expect(res.status).toBe(200);

			// Those connectors have nothing to resolve: their alerts do not come from
			// a list their delete could consult, so they leave the table alone.
			expect(activeIds()).toEqual(['c1', 'dd1', 'g1', 'g2']);
			expect(resolvedIds()).toEqual([]);
		}
	);

	test('deleting an unknown integration id changes nothing', async () => {
		const res = await deleteIntegration(987654);

		// Which exact code this answers with is settled in its own issue, so the
		// assertion here is only that it stays an error.
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(activeIds()).toEqual(['c1', 'dd1', 'g1', 'g2']);
		expect(resolvedIds()).toEqual([]);
	});
});

describe('the selection behind that delete', () => {
	test('an empty id set means the whole type, and only that type', async () => {
		expect(await selectedIds(new Set(), 'Grafana')).toEqual(['g1', 'g2']);
		expect(await selectedIds(new Set(), 'Custom')).toEqual(['c1']);
	});

	test('listed ids stay firing', async () => {
		expect(await selectedIds(new Set(['g1']), 'Grafana')).toEqual(['g2']);
		expect(await selectedIds(new Set(['g1', 'g2']), 'Grafana')).toEqual([]);
	});

	test('resolving a type that has no alerts does not move the auto counter', async () => {
		const before = await autoResolvedTotal();

		// Both Grafana alerts are still active, so the empty complement resolves nothing.
		await bl.resolveNonActiveAlerts(new Set(['g1', 'g2']), 'Grafana');

		expect(activeIds()).toEqual(['c1', 'dd1', 'g1', 'g2']);
		expect(resolvedIds()).toEqual([]);
		expect(await autoResolvedTotal()).toBe(before);
	});

	test('the auto counter moves by exactly the number of alerts that resolved', async () => {
		insertAlert('g3', 'Grafana');
		const before = await autoResolvedTotal();

		await bl.resolveNonActiveAlerts(new Set(['g1']), 'Grafana');

		expect(activeIds()).toEqual(['c1', 'dd1', 'g1']);
		expect(resolvedIds()).toEqual(['g2', 'g3']);
		expect(await autoResolvedTotal()).toBe(before + 2);
	});
});
