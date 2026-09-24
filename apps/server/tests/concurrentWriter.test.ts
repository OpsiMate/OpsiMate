import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { AlertRepository } from '../src/dal/alertRepository';
import { setupExpressApp } from './setup';

// In cluster mode several processes write the same SQLite file. A transaction that
// reads before it writes (the ingest upsert checks alerts_resolved first) must open
// with BEGIN IMMEDIATE: a DEFERRED one that started reading under one WAL snapshot is
// refused the write lock outright ("database is locked", no busy_timeout wait) as soon
// as another process has committed. This test holds the write lock from a second
// thread — standing in for another worker — while the repository ingests a batch.

const HOLD_MS = 400;

let dbPath = '';
let tmpDir = '';
let db: Database.Database;
let repo: AlertRepository;

interface HoldResult {
	heldMs: number;
}

// Takes the write lock on its own connection, keeps it for HOLD_MS, commits.
const holdWriteLock = () => {
	const script = `
		const { parentPort, workerData } = require('node:worker_threads');
		const Database = require(workerData.driver);
		const db = new Database(workerData.dbPath);
		db.pragma('busy_timeout = 5000');
		db.exec('BEGIN IMMEDIATE');
		db.prepare("INSERT INTO alerts (id, status, type, tags, starts_at, updated_at, alert_url, alert_name) VALUES ('held-by-other-writer','firing','Custom','{}','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z','','held')").run();
		parentPort.postMessage('locked');
		const started = Date.now();
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, workerData.holdMs);
		db.exec('COMMIT');
		db.close();
		parentPort.postMessage({ heldMs: Date.now() - started });
	`;
	const worker = new Worker(script, {
		eval: true,
		workerData: { driver: require.resolve('better-sqlite3'), dbPath, holdMs: HOLD_MS },
	});
	const locked = new Promise<void>((resolve, reject) => {
		worker.once('message', (m: unknown) => (m === 'locked' ? resolve() : reject(new Error(String(m)))));
		worker.once('error', reject);
	});
	const released = new Promise<HoldResult>((resolve, reject) => {
		worker.on('message', (m: unknown) => {
			if (typeof m === 'object' && m !== null) resolve(m as HoldResult);
		});
		worker.once('error', reject);
	});
	return { locked, released };
};

beforeAll(async () => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-writer-'));
	dbPath = path.join(tmpDir, 'db.sqlite');
	db = new Database(dbPath);
	db.pragma('journal_mode = WAL');
	db.pragma('busy_timeout = 5000');
	await setupExpressApp(db); // creates every table on this file-backed database
	repo = new AlertRepository(db);
});

afterAll(() => {
	db.close();
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ingest while another process holds the write lock', () => {
	test('waits for the other writer and then succeeds (BEGIN IMMEDIATE + busy_timeout)', async () => {
		const other = holdWriteLock();
		await other.locked;

		const now = new Date().toISOString();
		const started = Date.now();
		const results = await repo.insertOrUpdateAlerts([
			{
				id: 'from-this-worker',
				type: 'Custom',
				status: 'firing',
				tags: {},
				startsAt: now,
				updatedAt: now,
				alertUrl: '',
				alertName: 'ingested during contention',
			},
		]);
		const waitedMs = Date.now() - started;
		const { heldMs } = await other.released;

		expect(results).toEqual([{ changes: 1 }]);
		// It could only have got in after the other writer committed.
		expect(waitedMs).toBeGreaterThanOrEqual(HOLD_MS * 0.8);
		expect(heldMs).toBeGreaterThanOrEqual(HOLD_MS);
		const ids = (db.prepare(`SELECT id FROM alerts ORDER BY id`).all() as { id: string }[]).map((r) => r.id);
		expect(ids).toEqual(['from-this-worker', 'held-by-other-writer']);
	});
});
