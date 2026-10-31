import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { AlertHistoryEventType } from '@OpsiMate/shared';
import { AlertRepository } from '../src/dal/alertRepository';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// Timed silences expire lazily: every alert listing first sweeps alerts whose
// silenced_until has passed back to unsilenced and records a history entry.

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const HOUR_MS = 60 * 60 * 1000;

interface ListedAlert {
	id: string;
	isSilenced: boolean;
}

interface HistoryEntry {
	eventType?: string;
	description?: string;
}

interface ListingData {
	alerts: ListedAlert[];
}

interface ListingBody {
	data: ListingData;
}

interface HistoryData {
	data: HistoryEntry[];
}

interface HistoryBody {
	data: HistoryData;
}

const insertSilencedAlert = (id: string, silencedUntil: string | null) => {
	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO alerts (id, status, tags, starts_at, updated_at, alert_url, alert_name, summary, is_dismissed, silenced_until, silenced_at)
		 VALUES (?, 'firing', '{}', ?, ?, ?, ?, 'Summary', 1, ?, ?)`
	).run(id, now, now, `https://example.com/${id}`, `Alert ${id}`, silencedUntil, now);
};

const listAlerts = async (): Promise<ListedAlert[]> => {
	const res = await app.get('/api/v1/alerts').set('Authorization', `Bearer ${jwtToken}`);
	expect(res.status).toBe(200);
	return (res.body as ListingBody).data.alerts;
};

const isSilenced = (alerts: ListedAlert[], id: string) => alerts.find((alert) => alert.id === id)?.isSilenced;

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

beforeEach(() => {
	db.exec('DELETE FROM alerts');
});

describe('timed silence expiry', () => {
	test('a silence whose silencedUntil has passed reads as unsilenced on the next listing', async () => {
		insertSilencedAlert('expired', new Date(Date.now() - HOUR_MS).toISOString());

		expect(isSilenced(await listAlerts(), 'expired')).toBe(false);
	});

	test('a silence whose silencedUntil is in the future stays silenced', async () => {
		insertSilencedAlert('future', new Date(Date.now() + HOUR_MS).toISOString());

		expect(isSilenced(await listAlerts(), 'future')).toBe(true);
	});

	test('an indefinite silence (silencedUntil null) never expires', async () => {
		insertSilencedAlert('indefinite', null);

		expect(isSilenced(await listAlerts(), 'indefinite')).toBe(true);
		expect(isSilenced(await listAlerts(), 'indefinite')).toBe(true);
	});

	test('the swept alert gets an UNSILENCED "Silence expired" history event', async () => {
		insertSilencedAlert('expired-history', new Date(Date.now() - HOUR_MS).toISOString());
		await listAlerts();

		const res = await app.get('/api/v1/alerts/expired-history/history').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		const entries = (res.body as HistoryBody).data.data;
		expect(entries).toContainEqual(
			expect.objectContaining({ eventType: AlertHistoryEventType.UNSILENCED, description: 'Silence expired' })
		);
	});

	test('the repository returns the swept ids, and a second call returns none', async () => {
		const repo = new AlertRepository(db);
		const nowIso = new Date().toISOString();
		insertSilencedAlert('sweep-a', new Date(Date.now() - HOUR_MS).toISOString());
		insertSilencedAlert('sweep-b', new Date(Date.now() - 2 * HOUR_MS).toISOString());
		insertSilencedAlert('sweep-future', new Date(Date.now() + HOUR_MS).toISOString());
		insertSilencedAlert('sweep-indefinite', null);

		expect((await repo.clearExpiredSilences(nowIso)).sort()).toEqual(['sweep-a', 'sweep-b']);
		expect(await repo.clearExpiredSilences(nowIso)).toEqual([]);
	});

	test('a silence that ends exactly now expires (the comparison is inclusive)', async () => {
		const repo = new AlertRepository(db);
		const nowIso = new Date().toISOString();
		insertSilencedAlert('boundary', nowIso);

		expect(await repo.clearExpiredSilences(nowIso)).toEqual(['boundary']);
	});
});
