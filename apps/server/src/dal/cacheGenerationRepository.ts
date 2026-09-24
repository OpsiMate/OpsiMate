import Database from 'better-sqlite3';
import { runAsync } from './db';

// One integer, shared by every process that opens this database. Any write that
// changes what the alert snapshots would contain bumps it; every snapshot read
// compares it with the generation the cached copy was computed under. That is how a
// write in one cluster worker (or the retention job in the jobs process) invalidates
// the in-memory caches of all the others without IPC — SQLite is the bus. The read is
// a primary-key lookup of a one-row table: microseconds, next to a full snapshot
// rebuild that costs milliseconds to seconds.
interface GenerationRow {
	generation: number;
}

export class CacheGenerationRepository {
	private readSql: Database.Statement | null = null;
	private bumpSql: Database.Statement | null = null;

	constructor(private db: Database.Database) {}

	async initCacheGenerationTable(): Promise<void> {
		return runAsync(() => {
			this.db.exec(`
				CREATE TABLE IF NOT EXISTS cache_generation (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					generation INTEGER NOT NULL
				);
			`);
			this.db.prepare(`INSERT OR IGNORE INTO cache_generation (id, generation) VALUES (1, 0)`).run();
		});
	}

	// Synchronous on purpose: SnapshotCache consults it on every get() and must not
	// pay a Promise round-trip for a microsecond lookup.
	readSync(): number {
		this.readSql ??= this.db.prepare(`SELECT generation FROM cache_generation WHERE id = 1`);
		const row = this.readSql.get() as GenerationRow | undefined;
		return row?.generation ?? 0;
	}

	// Fire-and-forget from the write paths; a failed bump only means other processes
	// fall back to their TTL for this one write, which is the pre-cluster behaviour.
	bumpSync(): void {
		this.bumpSql ??= this.db.prepare(`UPDATE cache_generation SET generation = generation + 1 WHERE id = 1`);
		this.bumpSql.run();
	}
}
