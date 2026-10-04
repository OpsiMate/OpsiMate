import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Alert } from '@OpsiMate/shared';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { AlertBL } from '../src/bl/alerts/alert.bl';
import { ActiveListBuilder } from '../src/bl/alerts/activeListBuilder';
import { applyListDelta, resolveWorkerScript, SnapshotWorkerClient } from '../src/bl/alerts/snapshotWorkerClient';
import { AlertRepository } from '../src/dal/alertRepository';
import { AlertCommentsRepository } from '../src/dal/alertCommentsRepository';
import { AlertHistoryRepository } from '../src/dal/alertHistoryRepository';
import { ResolvedAlertRepository } from '../src/dal/resolvedAlertRepository';
import { UserRepository } from '../src/dal/userRepository';
import { setupExpressApp } from './setup';

// The active list built on a worker thread over the same database FILE, delivered to
// the main thread as deltas. The observable contract: same list and same ETag as the
// inline builder, and after the first build only what changed crosses the thread.

const alert = (id: string, tags: Record<string, string> = {}) => {
	const now = new Date().toISOString();
	return {
		id,
		type: 'Custom' as const,
		status: 'firing' as const,
		tags,
		startsAt: now,
		updatedAt: now,
		alertUrl: '',
		alertName: `alert ${id}`,
	};
};

describe('applyListDelta', () => {
	const a = { id: 'a' } as Alert;
	const b = { id: 'b' } as Alert;
	const b2 = { id: 'b', alertName: 'changed' } as Alert;

	test('first delta is the whole list; later ones replace, reorder and drop', () => {
		const known = new Map<string, Alert>();
		expect(applyListDelta(known, ['a', 'b'], [a, b])).toEqual([a, b]);
		const next = applyListDelta(known, ['b', 'a'], [b2]);
		expect(next[0]).toBe(b2);
		expect(next[1]).toBe(a); // untouched alert is the same object
		expect(applyListDelta(known, ['a'], [])).toEqual([a]);
		expect(known.has('b')).toBe(false);
	});

	test('an id the delta never delivered is an error, not a hole in the list', () => {
		expect(() => applyListDelta(new Map(), ['ghost'], [])).toThrow(/ghost/);
	});
});

describe('snapshot worker thread', () => {
	let tmpDir = '';
	let db: Database.Database;
	let bl: AlertBL;
	let client: SnapshotWorkerClient;
	let inline: ActiveListBuilder;

	beforeAll(async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-snapshot-worker-'));
		db = new Database(path.join(tmpDir, 'db.sqlite'));
		db.pragma('journal_mode = WAL');
		await setupExpressApp(db);
		const alertRepo = new AlertRepository(db);
		const commentsRepo = new AlertCommentsRepository(db);
		const historyRepo = new AlertHistoryRepository(db);
		bl = new AlertBL(alertRepo, new ResolvedAlertRepository(db), commentsRepo, historyRepo, new UserRepository(db));
		await bl.insertOrUpdateAlert(alert('a', { env: 'prod' }));
		await bl.insertOrUpdateAlert(alert('b', { env: 'prod' }));
		await bl.insertOrUpdateAlert(alert('c', { env: 'dev' }));
		const script = resolveWorkerScript();
		if (!script) throw new Error('worker script not resolvable in tests');
		client = new SnapshotWorkerClient(db.name, script);
		inline = new ActiveListBuilder(alertRepo, commentsRepo, historyRepo);
	});

	afterAll(async () => {
		await client.close();
		await bl.closeSnapshotWorker();
		db.close();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test('the worker builds the same list, with the same fingerprint, as the inline builder', async () => {
		const [fromWorker, fromInline] = await Promise.all([client.build(), inline.build()]);
		expect(fromWorker.alerts).toEqual(fromInline.alerts);
		expect(fromWorker.fingerprint).toBe(fromInline.fingerprint);
		expect(fromWorker.changed).toHaveLength(3); // first build: everything crosses
	}, 30_000);

	test('a later build ships only what changed; untouched alerts keep their identity on this thread', async () => {
		const before = await client.build();
		expect(before.changed).toHaveLength(0);
		await bl.insertOrUpdateAlert(alert('c', { env: 'dev', touched: 'yes' }));
		const after = await client.build();
		expect(after.changed.map((a) => a.id)).toEqual(['c']);
		expect(after.alerts.find((a) => a.id === 'a')).toBe(before.alerts.find((a) => a.id === 'a'));
		expect(after.alerts.find((a) => a.id === 'c')?.tags.touched).toBe('yes');
		expect(after.fingerprint).not.toBe(before.fingerprint);
	}, 30_000);

	test('AlertBL with the worker on serves the list and its ETag through the snapshot', async () => {
		expect(bl.useSnapshotWorker(db.name)).toBe(true);
		bl.invalidateSnapshots();
		const snapshot = await bl.getAlertsSnapshot();
		expect(snapshot.value.map((a) => a.id).sort()).toEqual(['a', 'b', 'c']);
		expect(snapshot.etag).toMatch(/^"[0-9a-f]{40}"$/);
		const inlineFingerprint = (await inline.build()).fingerprint;
		// Same content → same ETag as an inline build would produce.
		bl.invalidateSnapshots();
		const again = await bl.getAlertsSnapshot();
		expect(again.etag).toBe(snapshot.etag);
		expect(inlineFingerprint).toBe((await client.build()).fingerprint);
	}, 30_000);
});
