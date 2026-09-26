import Database from 'better-sqlite3';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { AlertBL } from '../src/bl/alerts/alert.bl';
import { EnrichmentBL } from '../src/bl/enrichments/enrichment.bl';
import { AuditBL } from '../src/bl/audit/audit.bl';
import { AlertRepository } from '../src/dal/alertRepository';
import { AlertCommentsRepository } from '../src/dal/alertCommentsRepository';
import { AlertHistoryRepository } from '../src/dal/alertHistoryRepository';
import { AuditLogRepository } from '../src/dal/auditLogRepository';
import { EnrichmentRepository } from '../src/dal/enrichmentRepository';
import { ResolvedAlertRepository } from '../src/dal/resolvedAlertRepository';
import { UserRepository } from '../src/dal/userRepository';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// The active list is rebuilt whenever anything changed, which under a webhook storm
// is constantly; the cost is bounded by keying per-alert work on each alert's inputs.
// The observable contract: an alert whose row, history, newest comment and the rule
// sets are unchanged is the SAME object as in the previous listing; anything that
// changes one of those yields a new object for that alert and only that alert.

let db: Database.Database;
let alertRepo: AlertRepository;
let commentsRepo: AlertCommentsRepository;
let enrichmentBL: EnrichmentBL;
let bl: AlertBL;
let userId: string;

interface UserIdRow {
	id: number;
}

const alert = (id: string, extra: Partial<Parameters<AlertBL['insertOrUpdateAlert']>[0]> = {}) => {
	const now = new Date().toISOString();
	return {
		id,
		type: 'Custom' as const,
		status: 'firing' as const,
		tags: { env: 'prod' },
		startsAt: now,
		updatedAt: now,
		alertUrl: '',
		alertName: `alert ${id}`,
		...extra,
	};
};

const listing = async () => {
	const alerts = await bl.getAllAlerts();
	return Object.fromEntries(alerts.map((a) => [a.id, a]));
};

beforeAll(async () => {
	db = await setupDB();
	const app = await setupExpressApp(db);
	await setupUserWithToken(app); // comments carry a user foreign key
	userId = String((db.prepare('SELECT id FROM users LIMIT 1').get() as UserIdRow).id);
	alertRepo = new AlertRepository(db);
	commentsRepo = new AlertCommentsRepository(db);
	bl = new AlertBL(
		alertRepo,
		new ResolvedAlertRepository(db),
		commentsRepo,
		new AlertHistoryRepository(db),
		new UserRepository(db)
	);
	enrichmentBL = new EnrichmentBL(new EnrichmentRepository(db), new AuditBL(new AuditLogRepository(db)));
	bl.setEnrichmentBL(enrichmentBL);
	await bl.insertOrUpdateAlert(alert('a'));
	await bl.insertOrUpdateAlert(alert('b'));
	await bl.insertOrUpdateAlert(alert('c'));
});

describe('active list reuses unchanged alerts between rebuilds', () => {
	test('repository: an unchanged row maps to the same object; a changed column to a new one', async () => {
		const first = await alertRepo.getAllAlerts();
		const second = await alertRepo.getAllAlerts();
		expect(second.map((a) => a)).toEqual(first);
		second.forEach((a, i) => expect(a).toBe(first[i]));

		await alertRepo.silenceAlert('b', null);
		const third = await alertRepo.getAllAlerts();
		const byId = Object.fromEntries(third.map((a) => [a.id, a]));
		expect(byId.a).toBe(first.find((a) => a.id === 'a'));
		expect(byId.b).not.toBe(first.find((a) => a.id === 'b'));
		expect(byId.b.isSilenced).toBe(true);
	});

	test('a webhook for one alert leaves every other listed alert as the same object', async () => {
		const before = await listing();
		await bl.insertOrUpdateAlert(alert('c', { tags: { env: 'prod', changed: 'yes' } }));
		const after = await listing();
		expect(after.a).toBe(before.a);
		expect(after.b).toBe(before.b);
		expect(after.c).not.toBe(before.c);
		expect(after.c.tags.changed).toBe('yes');
	});

	test('a new comment changes only that alert', async () => {
		const before = await listing();
		await commentsRepo.createComment({ alertId: 'a', userId, comment: 'first note' });
		bl.invalidateSnapshots();
		const after = await listing();
		expect(after.a).not.toBe(before.a);
		expect(after.a.lastComment).toBe('first note');
		expect(after.b).toBe(before.b);
		expect(after.b.lastComment).toBeNull();
	});

	test('an unresolve adds a firing time to that alert only', async () => {
		const before = await listing();
		const firingBefore = before.b.firingTimes?.length ?? 0;
		await bl.resolveAlert('b', { id: null, name: null });
		await bl.unresolveAlert('b', null);
		const after = await listing();
		expect(after.a).toBe(before.a);
		expect(after.b).not.toBe(before.b);
		expect(after.b.firingTimes?.length ?? 0).toBe(firingBefore + 1);
	});

	test('a rule change re-derives every alert; the base row objects are still reused', async () => {
		const before = await listing();
		const baseBefore = await alertRepo.getAllAlerts();
		await enrichmentBL.create({
			name: 'tag everything',
			labelMatchers: [],
			matchAll: true,
			addFields: [{ key: 'enriched', value: 'yes' }],
			priority: 1,
		});
		bl.invalidateSnapshots();
		const after = await listing();
		for (const id of ['a', 'b', 'c']) {
			expect(after[id]).not.toBe(before[id]);
			expect(after[id].tags.enriched).toBe('yes');
		}
		const baseAfter = await alertRepo.getAllAlerts();
		baseAfter.forEach((a, i) => expect(a).toBe(baseBefore[i]));
	});
	test('the list ETag is content-derived: a rebuild with nothing changed keeps it, a change rotates it', async () => {
		const first = await bl.getAlertsSnapshot();
		bl.invalidateSnapshots(); // forces a full recompute
		const second = await bl.getAlertsSnapshot();
		expect(second.etag).toBe(first.etag);
		expect(second.json).toBe(first.json);
		await bl.insertOrUpdateAlert(alert('c', { tags: { env: 'prod', changed: 'again' } }));
		const third = await bl.getAlertsSnapshot();
		expect(third.etag).not.toBe(first.etag);
		expect(JSON.parse(third.json)).toEqual(third.value);
	});
	test('a rule that throws for one alert leaves that alert unchanged and the list still served', async () => {
		const original = EnrichmentBL.enrichmentMatchesAlert;
		const spy = vi.spyOn(EnrichmentBL, 'enrichmentMatchesAlert').mockImplementation((enrichment, target) => {
			if (target.id === 'b') throw new Error('broken matcher');
			return original(enrichment, target);
		});
		try {
			// Only re-derived alerts run the rules; a webhook for b forces that for b alone.
			await bl.insertOrUpdateAlert(alert('b', { tags: { env: 'prod', refired: 'yes' } }));
			const after = await listing();
			expect(after.b.tags.refired).toBe('yes');
			expect(after.b.tags.enriched).toBeUndefined();
			expect(after.a.tags.enriched).toBe('yes');
			expect(after.c.tags.enriched).toBe('yes');
		} finally {
			spy.mockRestore();
		}
	});
});
