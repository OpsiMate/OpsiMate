import Database from 'better-sqlite3';
import { reencryptLegacyValue } from '../utils/encryption';

// The stored credentials that are encrypted with the install's key (see utils/encryption).
// Before installs generated their own key, an install without ENCRYPTION_KEY encrypted
// them with the public built-in key, so on such an upgrade they are moved to the new
// private key. Reading them works either way; this makes them actually protected.
// (Password-reset tokens are left alone: they expire within minutes.)
const ENCRYPTED_COLUMNS: ReadonlyArray<{ table: string; column: string }> = [
	{ table: 'ldap_config', column: 'bind_password' },
	{ table: 'ai_config', column: 'api_key' },
	{ table: 'integrations', column: 'credentials' },
];

interface TableInfoRow {
	name: string;
}

interface EncryptedRow {
	rid: number;
	value: string;
}

export interface ReencryptResult {
	moved: Record<string, number>;
	// Values that could not be moved this time (left exactly as they were; tried again on
	// the next start).
	failed: Record<string, number>;
}

const hasColumn = (db: Database.Database, table: string, column: string): boolean =>
	(db.prepare(`PRAGMA table_info(${table})`).all() as TableInfoRow[]).some((row) => row.name === column);

const bump = (counts: Record<string, number>, table: string): void => {
	counts[table] = (counts[table] ?? 0) + 1;
};

const nextTick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

// One value at a time, yielding to the event loop before each: checking a value costs a
// PBKDF2 derivation (several for one that moves), so a long table must not hold up requests
// or health checks. Each value is its own write, and only lands if the column still holds
// what was read, so a credential saved by an admin meanwhile is never overwritten. A value
// that fails (it does not round-trip, the write is refused) is left as it was and counted;
// the others still move, and the next start tries it again. Running it again is harmless:
// a moved value has nothing left to move.
export async function reencryptLegacyCredentials(
	db: Database.Database,
	pause: () => Promise<void> = nextTick
): Promise<ReencryptResult> {
	const result: ReencryptResult = { moved: {}, failed: {} };
	for (const { table, column } of ENCRYPTED_COLUMNS) {
		if (!hasColumn(db, table, column)) continue;
		const rows = db
			.prepare(`SELECT rowid AS rid, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL`)
			.all() as EncryptedRow[];
		const update = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ? AND ${column} = ?`);
		for (const row of rows) {
			await pause();
			try {
				const next = reencryptLegacyValue(row.value);
				if (next === null) continue;
				if (update.run(next, row.rid, row.value).changes > 0) bump(result.moved, table);
			} catch {
				bump(result.failed, table);
			}
		}
	}
	return result;
}
