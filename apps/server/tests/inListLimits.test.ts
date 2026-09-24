import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { AlertHistoryEventType, AlertStatus } from '@OpsiMate/shared';
import { AlertRepository } from '../src/dal/alertRepository';
import { AlertHistoryRepository } from '../src/dal/alertHistoryRepository';
import { setupDB, setupExpressApp } from './setup';

// SQLite allows 32,766 bound variables per statement. Every "WHERE id IN (?, ?, …)"
// built with one `?` per alert id therefore fails once an install has more active
// alerts than that — which under load it does, and the snapshot rebuild logged
// "too many SQL variables" and silently lost firing times. The lists now go in as one
// json parameter through json_each; these tests pin that with well over the limit.

const OVER_THE_LIMIT = 40_000;

let db: Database.Database;
let alertRepo: AlertRepository;
let historyRepo: AlertHistoryRepository;

const insertAlert = (id: string, type = 'Custom') => {
	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO alerts (id, status, type, tags, starts_at, updated_at, alert_url, alert_name, summary, is_dismissed)
		 VALUES (?, 'firing', ?, '{}', ?, ?, ?, ?, 'Summary', 0)`
	).run(id, type, now, now, `https://example.com/${id}`, `Alert ${id}`);
};

beforeAll(async () => {
	db = await setupDB();
	await setupExpressApp(db); // creates the history-events table
	alertRepo = new AlertRepository(db);
	historyRepo = new AlertHistoryRepository(db);
	insertAlert('real-1');
	insertAlert('real-2');
	insertAlert('other-type', 'Grafana');
	await historyRepo.recordEvent({ alertId: 'real-1', eventType: AlertHistoryEventType.UNRESOLVED });
});

afterAll(() => {
	db.close();
});

const manyIds = (): string[] => ['real-1', ...Array.from({ length: OVER_THE_LIMIT }, (_, i) => `ghost-${i}`)];

describe('id lists larger than the SQLite variable limit', () => {
	test('getFiringTimesByAlert accepts 40k ids and still finds the real one', async () => {
		const result = await alertRepo.getFiringTimesByAlert(manyIds());
		expect(Object.keys(result)).toEqual(['real-1']);
		expect(result['real-1']).toHaveLength(1);
	});

	test('getEventTimesByType accepts 40k ids', async () => {
		const result = await historyRepo.getEventTimesByType(AlertHistoryEventType.UNRESOLVED, manyIds());
		expect(Object.keys(result)).toEqual(['real-1']);
	});

	test('getAlertsNotInIds keeps NOT IN semantics across 40k ids', async () => {
		const notListed = await alertRepo.getAlertsNotInIds(new Set(manyIds()), 'Custom');
		expect(notListed.map((alert) => alert.id)).toEqual(['real-2']);
		expect(notListed[0].status).toBe(AlertStatus.FIRING);
	});

	test('deleteAlertsNotInIds deletes only the unlisted alerts of that type across 40k ids', async () => {
		await alertRepo.deleteAlertsNotInIds(new Set(manyIds()), 'Custom');
		const remaining = (db.prepare(`SELECT id FROM alerts ORDER BY id`).all() as { id: string }[]).map(
			(row) => row.id
		);
		expect(remaining).toEqual(['other-type', 'real-1']);
	});
});
