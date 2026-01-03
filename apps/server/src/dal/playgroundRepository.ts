import Database from 'better-sqlite3';
import { runAsync } from './db';

export class PlaygroundRepository {
	constructor(private db: Database.Database) {}

	async bookDemo(email?: string, trackingId?: string): Promise<void> {
		return runAsync(() => {
			const stmt = this.db.prepare(`
                INSERT INTO playground_demos (email, tracking_id)
                VALUES (?, ?)
            `);
			stmt.run(email ?? null, trackingId ?? null);
		});
	}

	async initPlaygroundTable(): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`
                        CREATE TABLE IF NOT EXISTS playground_demos
                        (
                            id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                            email       TEXT,
                            tracking_id TEXT,
                            created_at  DATETIME         DEFAULT CURRENT_TIMESTAMP
                        )
                    `
				)
				.run();
		});
	}
}
