import Database from 'better-sqlite3';
import { runAsync } from './db';
import { InsertResult, TableInfoRow, UserRow } from './models';
import {
	Logger,
	Role,
	User,
	UserAuthSource,
	USERNAME_MAX_LENGTH,
	usernameFromEmail,
	usernameVariant,
} from '@OpsiMate/shared';

// Numbered variants go up to four digits (9999): long enough for any real collision set,
// short enough that the LIKE stem below still identifies them.
const USERNAME_VARIANT_SUFFIX_DIGITS = 4;

const logger = new Logger('dal/userRepository');

// How an identifier maps onto an existing account, for directory provisioning.
export interface DirectoryAccountLink {
	id: number;
	authSource: UserAuthSource;
	ldapDn: string | null;
	// The directory object's stable id (see LdapIdentity.objectId); null until a login
	// after this column existed recorded it.
	ldapObjectId: string | null;
}

export interface NewUserRow {
	username: string;
	// null = no contact address; the user signs in with the username only.
	email: string | null;
	passwordHash: string;
	fullName: string;
	role: Role;
	authSource?: UserAuthSource;
	ldapDn?: string | null;
	ldapObjectId?: string | null;
}

export interface UserUpdates {
	fullName?: string;
	username?: string;
	// null clears the address.
	email?: string | null;
	role?: string;
}

export interface LoginRecord {
	user: User;
	passwordHash: string;
}

const USER_COLUMNS = 'id, username, email, full_name, role, created_at, phone_number, auth_source';
const LINK_COLUMNS = 'id, auth_source, ldap_dn, ldap_object_id';

const toLink = (row: UserRow): DirectoryAccountLink => ({
	id: Number(row.id),
	authSource: row.auth_source === 'ldap' ? 'ldap' : 'local',
	ldapDn: row.ldap_dn ?? null,
	ldapObjectId: row.ldap_object_id ?? null,
});

// The table as a fresh database gets it. username is the identity (unique ignoring case,
// see the index below); email is optional and unique when present (SQLite's UNIQUE lets
// any number of rows be NULL).
const CREATE_USERS_TABLE = (name: string) => `
	CREATE TABLE IF NOT EXISTS ${name} (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL,
		email TEXT UNIQUE,
		password_hash TEXT NOT NULL,
		full_name TEXT NOT NULL,
		role TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		phone_number TEXT,
		auth_source TEXT NOT NULL DEFAULT 'local',
		ldap_dn TEXT,
		ldap_object_id TEXT
	)`;

export class UserRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async initUsersTable(): Promise<void> {
		return runAsync(() => {
			this.db.prepare(CREATE_USERS_TABLE('users')).run();

			// Backward compatibility, oldest first: each step brings a table created by an
			// earlier version up to the shape above.
			const columns = this.db.prepare(`PRAGMA table_info(users)`).all() as TableInfoRow[];
			const has = (name: string) => columns.some((col) => col.name === name);
			if (!has('phone_number')) {
				this.db.prepare(`ALTER TABLE users ADD COLUMN phone_number TEXT`).run();
			}
			// 'local' (bcrypt password here) or 'ldap' (password in the directory). Every
			// existing account is local.
			if (!has('auth_source')) {
				this.db.prepare(`ALTER TABLE users ADD COLUMN auth_source TEXT NOT NULL DEFAULT 'local'`).run();
			}
			// The directory entry (DN) an LDAP account belongs to: a later login from a
			// different entry with the same identity must not get this account.
			if (!has('ldap_dn')) {
				this.db.prepare(`ALTER TABLE users ADD COLUMN ldap_dn TEXT`).run();
			}
			// The directory object's stable id behind an LDAP account (entryUUID / objectGUID):
			// a DN can be reused by a new entry, this cannot. Filled in at the next login.
			if (!has('ldap_object_id')) {
				this.db.prepare(`ALTER TABLE users ADD COLUMN ldap_object_id TEXT`).run();
			}
			// Accounts used to be keyed on the email. Every row gets a username (the local
			// part of its address), and the email column stops being required.
			if (!has('username')) this.db.prepare(`ALTER TABLE users ADD COLUMN username TEXT`).run();
			// Always, not only right after adding the column: a start-up that stopped between
			// the two left rows without a username, and the rebuild below copies into a NOT
			// NULL column. Fills the missing ones only; assigned names are kept.
			this.backfillUsernames();
			const emailColumn = (this.db.prepare(`PRAGMA table_info(users)`).all() as TableInfoRow[]).find(
				(col) => col.name === 'email'
			);
			if (emailColumn?.notnull) this.rebuildWithOptionalEmail();

			// Unique ignoring case: "IdanL" and "idanl" are one account. Rows are stored
			// lowercased anyway; the index is the guarantee.
			this.db
				.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username COLLATE NOCASE)`)
				.run();
			this.ensureEmailUniqueIgnoringCase();
			this.ensureObjectIdUnique();
		});
	}

	// One directory object, one account: two first logins for the same object that both
	// pass the lookup must not both insert (the loser re-reads by object id, see UserBL).
	// Null ids (local accounts, directories without entryUUID) are not compared.
	private ensureObjectIdUnique(): void {
		const duplicates = this.db
			.prepare(
				`SELECT ldap_object_id AS id, COUNT(*) AS n FROM users WHERE ldap_object_id IS NOT NULL GROUP BY ldap_object_id HAVING n > 1`
			)
			.all() as { id: string; n: number }[];
		if (duplicates.length > 0) {
			logger.warn(
				`Several accounts are linked to one directory object: ${duplicates.map((d) => d.id).join(', ')}. ` +
					'Delete the duplicates so the object id can be made unique.'
			);
			return;
		}
		this.db
			.prepare(
				`CREATE UNIQUE INDEX IF NOT EXISTS users_ldap_object_id_unique ON users (ldap_object_id) WHERE ldap_object_id IS NOT NULL`
			)
			.run();
	}

	// Every lookup treats Dana@x and dana@x as one address, so the database should refuse
	// the second as well — two concurrent creates could otherwise both pass the check made
	// before the write. An old database may already hold such variants; they cannot be
	// merged here, so the index is skipped with a warning naming them (the column's own
	// case-sensitive UNIQUE still holds), and added once an admin has sorted them out.
	private ensureEmailUniqueIgnoringCase(): void {
		const variants = this.db
			.prepare(
				`SELECT lower(email) AS address, COUNT(*) AS n FROM users WHERE email IS NOT NULL GROUP BY lower(email) HAVING n > 1`
			)
			.all() as { address: string; n: number }[];
		if (variants.length > 0) {
			logger.warn(
				`Emails that differ only by letter case belong to several accounts: ${variants.map((v) => v.address).join(', ')}. ` +
					'Give each its own address so the email can be made unique ignoring case.'
			);
			return;
		}
		this.db
			.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_nocase ON users (email COLLATE NOCASE)`)
			.run();
	}

	// Every account without a username gets one from its email's local part; a name
	// already taken (ignoring case) gets a numeric suffix, which the log reports so an
	// admin can tidy it up. Oldest account first, so it keeps the plain name.
	private backfillUsernames(): void {
		const rows = this.db
			.prepare(`SELECT id, email FROM users WHERE username IS NULL OR username = '' ORDER BY id`)
			.all() as Pick<UserRow, 'id' | 'email'>[];
		const taken = new Set(
			(
				this.db.prepare(`SELECT username FROM users WHERE username IS NOT NULL`).all() as Pick<
					UserRow,
					'username'
				>[]
			).map((row) => row.username.toLowerCase())
		);
		const update = this.db.prepare(`UPDATE users SET username = ? WHERE id = ?`);
		for (const row of rows) {
			const base = usernameFromEmail(row.email ?? `user${row.id}`);
			let candidate = base;
			for (let n = 2; taken.has(candidate); n++) candidate = usernameVariant(base, n);
			if (candidate !== base) {
				logger.warn(`User ${row.id} (${row.email}): username "${base}" was taken, assigned "${candidate}"`);
			}
			taken.add(candidate);
			update.run(candidate, row.id);
		}
		if (rows.length > 0) logger.info(`Assigned usernames to ${rows.length} existing user(s)`);
	}

	// SQLite cannot drop NOT NULL in place: the table is rebuilt and the rows copied,
	// ids included. Foreign keys are switched off around it, or dropping the old table
	// would cascade-delete every comment, reset token and on-call membership; the
	// pragma cannot change inside a transaction, so it brackets one. Other tables'
	// constraints still name "users" and are whole again after the rename — checked by
	// comparing foreign_key_check before and after: the app runs without the pragma, so
	// an old database may already hold dangling rows, which are not this rebuild's to
	// refuse; only NEW violations roll it back.
	private rebuildWithOptionalEmail(): void {
		const foreignKeysWereOn = (this.db.pragma('foreign_keys', { simple: true }) as number) === 1;
		try {
			if (foreignKeysWereOn) this.db.pragma('foreign_keys = OFF');
			this.db.transaction(() => {
				const violationsBefore = (this.db.pragma('foreign_key_check') as unknown[]).length;
				// The AUTOINCREMENT watermark: dropping the table forgets it, and a rebuilt
				// table could then hand a deleted account's id to a new one — which an
				// unexpired token of the old account would resolve to.
				const watermark = (
					this.db.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'users'`).get() as
						{ seq: number } | undefined
				)?.seq;
				this.db.prepare(`DROP TABLE IF EXISTS users_new`).run();
				this.db.prepare(CREATE_USERS_TABLE('users_new')).run();
				this.db
					.prepare(
						`INSERT INTO users_new (id, username, email, password_hash, full_name, role, created_at, phone_number, auth_source, ldap_dn)
						 SELECT id, username, email, password_hash, full_name, role, created_at, phone_number, auth_source, ldap_dn FROM users`
					)
					.run();
				this.db.prepare(`DROP TABLE users`).run();
				this.db.prepare(`ALTER TABLE users_new RENAME TO users`).run();
				if (watermark !== undefined) {
					const current = (
						this.db.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'users'`).get() as
							{ seq: number } | undefined
					)?.seq;
					const seq = Math.max(watermark, current ?? 0);
					if (current === undefined) {
						this.db.prepare(`INSERT INTO sqlite_sequence (name, seq) VALUES ('users', ?)`).run(seq);
					} else {
						this.db.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = 'users'`).run(seq);
					}
				}
				const violationsAfter = (this.db.pragma('foreign_key_check') as unknown[]).length;
				if (violationsAfter > violationsBefore) {
					throw new Error(
						`users table rebuild left ${violationsAfter - violationsBefore} new dangling foreign key(s)`
					);
				}
			})();
			logger.info('users table rebuilt: email is optional now');
		} finally {
			if (foreignKeysWereOn) this.db.pragma('foreign_keys = ON');
		}
	}

	async createUser(row: NewUserRow): Promise<InsertResult> {
		return runAsync<InsertResult>(() => {
			const stmt = this.db.prepare(
				'INSERT INTO users (username, email, password_hash, full_name, role, auth_source, ldap_dn, ldap_object_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
			);
			const result = stmt.run(
				row.username.toLowerCase(),
				row.email,
				row.passwordHash,
				row.fullName,
				row.role,
				row.authSource ?? 'local',
				row.ldapDn ?? null,
				row.ldapObjectId ?? null
			);
			return { lastID: result.lastInsertRowid as number };
		});
	}

	// The account behind a username, with its password hash, for a login.
	async findLoginByUsername(username: string): Promise<LoginRecord | undefined> {
		return runAsync(() => {
			const row = this.db
				.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
				.get(username.trim()) as UserRow | undefined;
			return row ? { user: this.toSharedUser(row), passwordHash: row.password_hash } : undefined;
		});
	}

	// Among the accounts an address matches ignoring case — several only in an old database
	// that let spellings coexist — the one spelled exactly as typed comes first, then the one
	// spelled in lowercase (what a login used to fall back to), then the oldest.
	private static readonly EMAIL_SPELLING_ORDER = 'ORDER BY (email = ?) DESC, (email = lower(?)) DESC, id';

	// The account behind an email, with its password hash, for a login.
	async findLoginByEmail(email: string): Promise<LoginRecord | undefined> {
		return runAsync(() => {
			const address = email.trim();
			const row = this.db
				.prepare(
					`SELECT * FROM users WHERE email = ? COLLATE NOCASE ${UserRepository.EMAIL_SPELLING_ORDER} LIMIT 1`
				)
				.get(address, address, address) as UserRow | undefined;
			return row ? { user: this.toSharedUser(row), passwordHash: row.password_hash } : undefined;
		});
	}

	async getPasswordHash(userId: number): Promise<string | undefined> {
		return runAsync(() => {
			const row = this.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as
				Pick<UserRow, 'password_hash'> | undefined;
			return row?.password_hash;
		});
	}

	async countUsers(): Promise<number> {
		return runAsync(() => {
			const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
			const row = stmt.get() as { count: number };
			return row.count;
		});
	}

	async updateUserRoleById(userId: number, newRole: Role): Promise<boolean> {
		return runAsync(() => {
			return this.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, userId).changes > 0;
		});
	}

	async getAllUsers(): Promise<User[]> {
		return runAsync(() => {
			const userRows = this.db.prepare(`SELECT ${USER_COLUMNS} FROM users`).all() as UserRow[];
			return userRows.map(this.toSharedUser);
		});
	}

	async getUserById(id: number): Promise<User | null> {
		return runAsync(() => {
			const row = this.db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) as
				UserRow | undefined;
			return row ? this.toSharedUser(row) : null;
		});
	}

	async deleteUser(id: number): Promise<void> {
		return runAsync(() => {
			this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
		});
	}

	async updateUserProfile(
		id: number,
		fullName: string,
		passwordHash?: string,
		phoneNumber?: string | null
	): Promise<void> {
		return runAsync(() => {
			const setClauses = ['full_name = ?'];
			const values: (string | number | null)[] = [fullName];
			if (passwordHash) {
				setClauses.push('password_hash = ?');
				values.push(passwordHash);
			}
			// undefined = leave unchanged; null/'' = clear.
			if (phoneNumber !== undefined) {
				setClauses.push('phone_number = ?');
				values.push(phoneNumber || null);
			}
			values.push(id);
			this.db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
		});
	}

	async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
		return runAsync(() => {
			const stmt = this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
			stmt.run(hashedPassword, userId);
		});
	}

	async updateUser(userId: number, updates: UserUpdates): Promise<void> {
		return runAsync(() => {
			const setClauses: string[] = [];
			const values: (string | number | null)[] = [];

			if (updates.fullName !== undefined) {
				setClauses.push('full_name = ?');
				values.push(updates.fullName);
			}
			if (updates.username !== undefined) {
				setClauses.push('username = ?');
				values.push(updates.username.toLowerCase());
			}
			if (updates.email !== undefined) {
				setClauses.push('email = ?');
				values.push(updates.email);
			}
			if (updates.role !== undefined) {
				setClauses.push('role = ?');
				values.push(updates.role);
			}

			if (setClauses.length === 0) {
				return;
			}

			values.push(userId);
			this.db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
		});
	}

	private toSharedUser = (row: UserRow): User => {
		return {
			id: String(row.id),
			username: row.username,
			email: row.email ?? null,
			fullName: row.full_name,
			role: row.role,
			createdAt: row.created_at,
			phoneNumber: row.phone_number ?? null,
			authSource: row.auth_source === 'ldap' ? 'ldap' : 'local',
		};
	};

	// An LDAP login keeps the local copy in step with the directory: name, role, email
	// and username are the directory's on every login.
	// `email` / `username` undefined leave the stored value as it is, in the same write as
	// the rest — not re-saved from an earlier read that another login may have outdated.
	async syncDirectoryUser(
		userId: number,
		fullName: string,
		role: string,
		email: string | null | undefined,
		username: string | undefined
	): Promise<void> {
		return runAsync(() => {
			const sets = ['full_name = ?', 'role = ?'];
			const values: (string | number | null)[] = [fullName, role];
			if (email !== undefined) {
				sets.push('email = ?');
				values.push(email);
			}
			if (username !== undefined) {
				sets.push('username = ?');
				values.push(username.toLowerCase());
			}
			this.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values, userId);
		});
	}

	// The account a directory entry (DN) already has, whatever it is called now.
	// Every account recorded at a DN, oldest first: a DN can have been reused by another
	// directory object, so there may be more than one.
	async findDirectoryLinksByDn(dn: string): Promise<DirectoryAccountLink[]> {
		return runAsync(() => {
			const rows = this.db
				.prepare(`SELECT ${LINK_COLUMNS} FROM users WHERE ldap_dn = ? COLLATE NOCASE ORDER BY id`)
				.all(dn.trim()) as UserRow[];
			return rows.map(toLink);
		});
	}

	// Any account whose username matches ignoring case.
	async findDirectoryLinkByUsername(username: string): Promise<DirectoryAccountLink | null> {
		return runAsync(() => {
			const row = this.db
				.prepare(`SELECT ${LINK_COLUMNS} FROM users WHERE username = ? COLLATE NOCASE`)
				.get(username.trim()) as UserRow | undefined;
			return row ? toLink(row) : null;
		});
	}

	// Any account whose email matches ignoring case: the UNIQUE constraint is
	// case-sensitive, so "Alice@x" (local) and "alice@x" could otherwise coexist.
	async findDirectoryLink(email: string): Promise<DirectoryAccountLink | null> {
		return runAsync(() => {
			const row = this.db
				.prepare(`SELECT ${LINK_COLUMNS} FROM users WHERE email = ? COLLATE NOCASE ORDER BY id LIMIT 1`)
				.get(email) as UserRow | undefined;
			return row ? toLink(row) : null;
		});
	}

	// Where the account's directory entry lives now (DN) and which object it is (stable id).
	async setDirectoryLink(userId: number, dn: string, objectId: string | null): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare('UPDATE users SET ldap_dn = ?, ldap_object_id = COALESCE(?, ldap_object_id) WHERE id = ?')
				.run(dn, objectId, userId);
		});
	}

	// The account a directory object already has, whatever it is called or wherever it
	// sits now.
	async findDirectoryLinkByObjectId(objectId: string): Promise<DirectoryAccountLink | null> {
		return runAsync(() => {
			const row = this.db
				.prepare(`SELECT ${LINK_COLUMNS} FROM users WHERE ldap_object_id = ? ORDER BY id LIMIT 1`)
				.get(objectId) as UserRow | undefined;
			return row ? toLink(row) : null;
		});
	}

	// The account behind an address, ignoring case (see EMAIL_SPELLING_ORDER).
	async getUserByEmail(email: string): Promise<User | null> {
		return runAsync(() => {
			const address = email.trim();
			const row = this.db
				.prepare(
					`SELECT ${USER_COLUMNS} FROM users WHERE email = ? COLLATE NOCASE ${UserRepository.EMAIL_SPELLING_ORDER} LIMIT 1`
				)
				.get(address, address, address) as UserRow | undefined;
			return row ? this.toSharedUser(row) : null;
		});
	}

	// Every account whose address matches ignoring case (see EMAIL_SPELLING_ORDER).
	async findUsersByEmail(email: string): Promise<User[]> {
		return runAsync(() => {
			const address = email.trim();
			const rows = this.db
				.prepare(
					`SELECT ${USER_COLUMNS} FROM users WHERE email = ? COLLATE NOCASE ${UserRepository.EMAIL_SPELLING_ORDER}`
				)
				.all(address, address, address) as UserRow[];
			return rows.map(this.toSharedUser);
		});
	}

	// A username nobody holds: `base` itself, else the first free numbered variant (see
	// usernameVariant). One query: every name that starts with the stem all variants
	// share — the base shortened by the longest suffix considered, since a variant of a
	// long name is truncated before its number — compared ignoring case, as the unique
	// index does.
	async nextFreeUsername(base: string): Promise<string> {
		return runAsync(() => {
			const stem = base.slice(0, USERNAME_MAX_LENGTH - USERNAME_VARIANT_SUFFIX_DIGITS);
			const escaped = stem.replace(/[\\%_]/g, (ch) => `\\${ch}`);
			const rows = this.db
				.prepare(`SELECT username FROM users WHERE username LIKE ? ESCAPE '\\' COLLATE NOCASE`)
				.all(`${escaped}%`) as Pick<UserRow, 'username'>[];
			const taken = new Set(rows.map((row) => row.username.toLowerCase()));
			for (let n = 1; n < 10 ** USERNAME_VARIANT_SUFFIX_DIGITS; n++) {
				const candidate = usernameVariant(base, n);
				if (!taken.has(candidate.toLowerCase())) return candidate;
			}
			throw new Error(`No free username variant of ${base}`);
		});
	}

	async getUserByUsername(username: string): Promise<User | null> {
		return runAsync(() => {
			const row = this.db
				.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE username = ? COLLATE NOCASE`)
				.get(username.trim()) as UserRow | undefined;
			return row ? this.toSharedUser(row) : null;
		});
	}
}
