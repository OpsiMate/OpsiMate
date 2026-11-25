import Database from 'better-sqlite3';
import { reencryptLegacyValue } from '../utils/encryption';

// The stored credentials that are encrypted with the install's key (see utils/encryption).
// Before installs generated their own key, an install without ENCRYPTION_KEY encrypted
// them with the public built-in key, so on such an upgrade they are moved, once, to the
// new private key. Reading them works either way; this makes them actually protected.
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

const hasColumn = (db: Database.Database, table: string, column: string): boolean =>
	(db.prepare(`PRAGMA table_info(${table})`).all() as TableInfoRow[]).some((row) => row.name === column);

// Returns how many values were moved per table. All in one transaction: a value that does
// not round-trip throws (see reencryptLegacyValue), and then nothing is changed at all.
export function reencryptLegacyCredentials(db: Database.Database): Record<string, number> {
	const moved: Record<string, number> = {};
	db.transaction(() => {
		for (const { table, column } of ENCRYPTED_COLUMNS) {
			if (!hasColumn(db, table, column)) continue;
			const rows = db
				.prepare(`SELECT rowid AS rid, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL`)
				.all() as EncryptedRow[];
			const update = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`);
			for (const row of rows) {
				const next = reencryptLegacyValue(row.value);
				if (next === null) continue;
				update.run(next, row.rid);
				moved[table] = (moved[table] ?? 0) + 1;
			}
		}
	})();
	return moved;
}
