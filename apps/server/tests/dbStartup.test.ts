import { ChildProcess, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { applyConnectionPragmas, SCHEMA_LOCK_FILE, withSchemaLock } from '../src/dal/db';

// The backend and the worker open the same database and both prepare its schema, often at
// the same moment (docker compose up on a fresh install). SQLite only ever lets one of
// them write; these tests pin down the two places where the second process used to crash
// instead of waiting. The other process has to be a real process: better-sqlite3 blocks
// the thread while it waits, so nothing in this one could release a lock meanwhile.

const FIXTURE = path.join(__dirname, 'fixtures', 'schemaLockProcess.ts');

// A child whose stdout lines the test can wait for.
function startProcess(args: string[]): { child: ChildProcess; lines: string[]; next: (word: string) => Promise<void> } {
	const child = spawn(process.execPath, ['--import', 'tsx', ...args], {
		cwd: path.resolve(__dirname, '..'),
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	const lines: string[] = [];
	const waiters: Array<{ word: string; resolve: () => void }> = [];
	// A chunk is not a line: a marker can arrive split across two chunks.
	let pending = '';
	child.stdout.on('data', (chunk: Buffer) => {
		const parts = (pending + String(chunk)).split('\n');
		pending = parts.pop() ?? '';
		for (const line of parts.map((l) => l.trim()).filter(Boolean)) {
			lines.push(line);
			for (const waiter of waiters.splice(0)) {
				if (lines.includes(waiter.word)) waiter.resolve();
				else waiters.push(waiter);
			}
		}
	});
	const stderr: string[] = [];
	child.stderr.on('data', (chunk: Buffer) => stderr.push(String(chunk)));
	const next = (word: string) =>
		new Promise<void>((resolve, reject) => {
			if (lines.includes(word)) return resolve();
			const timer = setTimeout(
				() =>
					reject(
						new Error(
							`child never printed "${word}"; stdout: ${lines.join(' | ')}; stderr: ${stderr.join('')}`
						)
					),
				20000
			);
			waiters.push({
				word,
				resolve: () => {
					clearTimeout(timer);
					resolve();
				},
			});
		});
	return { child, lines, next };
}

function exited(child: ChildProcess): Promise<number | null> {
	return new Promise((resolve) => {
		if (child.exitCode !== null || child.signalCode !== null) return resolve(child.exitCode);
		child.once('exit', (code) => resolve(code));
	});
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The fixture's own step words, without the server's log lines.
const steps = (lines: string[]) => lines.filter((line) => !line.startsWith('['));

describe('opening the database while another process writes to it', () => {
	let dir: string;
	let dbPath: string;
	const children: ChildProcess[] = [];

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-db-startup-'));
		dbPath = path.join(dir, 'opsimate.db');
	});

	afterEach(async () => {
		for (const child of children.splice(0)) {
			child.kill('SIGKILL');
			await exited(child);
		}
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test('the switch to WAL waits for the writer instead of failing at once', async () => {
		// A fresh database (rollback journal, not yet WAL) that another process is in the
		// middle of writing to, the way the first process to start is while the second opens.
		const writer = startProcess([
			'-e',
			`const Database = require('better-sqlite3');
			 const db = new Database(${JSON.stringify(dbPath)});
			 db.exec('CREATE TABLE t (a TEXT)');
			 db.exec('BEGIN IMMEDIATE');
			 db.exec("INSERT INTO t VALUES ('x')");
			 console.log('started');
			 setTimeout(() => { db.exec('COMMIT'); db.close(); }, 700);`,
		]);
		children.push(writer.child);
		await writer.next('started');

		// Plain SQLite: the busy timeout does not help here, the error is immediate.
		const bare = new Database(dbPath);
		expect(bare.pragma('busy_timeout', { simple: true })).toBeGreaterThan(0);
		expect(() => bare.pragma('journal_mode = WAL')).toThrow(/database is locked/);
		bare.close();

		const db = new Database(dbPath);
		applyConnectionPragmas(db);
		expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
		expect(db.prepare('SELECT count(*) AS n FROM t').get()).toEqual({ n: 1 });
		db.close();
		expect(await exited(writer.child)).toBe(0);
	});

	test('a check-then-alter migration in two processes at once adds the column once', async () => {
		const db = new Database(dbPath);
		applyConnectionPragmas(db);
		db.exec('CREATE TABLE t (a TEXT)');
		const columnNames = () => (db.prepare(`PRAGMA table_info(t)`).all() as { name: string }[]).map((c) => c.name);

		let other: ReturnType<typeof startProcess> | undefined;
		await withSchemaLock(db, async () => {
			// This process has seen the old shape and is about to alter it; the other one
			// starts now and must wait for the lock rather than see the same old shape.
			expect(columnNames()).toEqual(['a']);
			other = startProcess([FIXTURE, dbPath, 'migrate']);
			children.push(other.child);
			await other.next('started');
			await sleep(500);
			expect(steps(other.lines)).toEqual(['started']);
			expect(other.lines.some((line) => line.includes('waiting for it to finish'))).toBe(true);
			db.exec(`ALTER TABLE t ADD COLUMN b TEXT`);
		});

		expect(await exited(other!.child)).toBe(0);
		expect(steps(other!.lines)).toEqual(['started', 'skipped']);
		expect(columnNames()).toEqual(['a', 'b']);
		expect(fs.existsSync(path.join(dir, SCHEMA_LOCK_FILE))).toBe(true);
		db.close();
	});

	test('a lock held by a process that dies is released with it', async () => {
		const db = new Database(dbPath);
		applyConnectionPragmas(db);
		const holder = startProcess([FIXTURE, dbPath, 'hold']);
		children.push(holder.child);
		await holder.next('holding');

		// The lock is a write transaction on the lock database, so while the holder lives
		// nobody else can begin one there.
		const probe = new Database(path.join(dir, SCHEMA_LOCK_FILE));
		probe.pragma('busy_timeout = 0');
		expect(() => probe.exec('BEGIN IMMEDIATE')).toThrow(/database is locked/);
		probe.close();

		holder.child.kill('SIGKILL');
		await exited(holder.child);
		const started = Date.now();
		expect(await withSchemaLock(db, () => Promise.resolve('ran'))).toBe('ran');
		expect(Date.now() - started).toBeLessThan(2000);
		db.close();
	});

	test('an in-memory database needs no lock and leaves no file', async () => {
		const db = new Database(':memory:');
		expect(await withSchemaLock(db, () => Promise.resolve('ran'))).toBe('ran');
		expect(fs.readdirSync(dir)).toEqual([]);
		db.close();
	});
});
