import Database from 'better-sqlite3';
import { runAsync } from './db';

// Singleton LDAP settings row saved from the Settings page (same pattern as
// ai_config): one org-wide record, id pinned to 1. `settings` is the JSON of the
// LdapConfig minus the service-account password; `bind_password` holds the
// encryptPassword() ciphertext of that password — never plaintext.

export interface LdapConfigRow {
	settings: string;
	bind_password: string | null;
	updated_at: string | null;
}

// What mergeConfig's callback returns: the row to store.
export interface LdapConfigWrite {
	settings: string;
	bind_password: string | null;
}

const EMPTY_ROW: LdapConfigRow = { settings: '{}', bind_password: null, updated_at: null };

export class LdapConfigRepository {
	constructor(private db: Database.Database) {}

	initLdapConfigTable(): Promise<void> {
		return runAsync(() => {
			this.db.exec(`
				CREATE TABLE IF NOT EXISTS ldap_config (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					settings TEXT NOT NULL DEFAULT '{}',
					bind_password TEXT,
					updated_at TEXT
				);
			`);
		});
	}

	getConfig(): Promise<LdapConfigRow> {
		return runAsync(
			() =>
				(this.db.prepare(`SELECT settings, bind_password, updated_at FROM ldap_config WHERE id = 1`).get() as
					LdapConfigRow | undefined) ?? EMPTY_ROW
		);
	}

	// Read-merge-write in ONE transaction, so two saves at once can't drop each other's
	// fields. The callback is synchronous (better-sqlite3); whatever it throws rolls the
	// transaction back and leaves the stored settings untouched.
	mergeConfig(merge: (current: LdapConfigRow) => LdapConfigWrite): Promise<LdapConfigRow> {
		return runAsync(() => {
			const run = this.db.transaction(() => {
				const current =
					(this.db
						.prepare(`SELECT settings, bind_password, updated_at FROM ldap_config WHERE id = 1`)
						.get() as LdapConfigRow | undefined) ?? EMPTY_ROW;
				const next = merge(current);
				const updatedAt = new Date().toISOString();
				this.db
					.prepare(
						`INSERT INTO ldap_config (id, settings, bind_password, updated_at)
						 VALUES (1, ?, ?, ?)
						 ON CONFLICT(id) DO UPDATE SET
							settings = excluded.settings,
							bind_password = excluded.bind_password,
							updated_at = excluded.updated_at`
					)
					.run(next.settings, next.bind_password, updatedAt);
				return { ...next, updated_at: updatedAt };
			});
			return run();
		});
	}
}
