import Database from 'better-sqlite3';
import { runAsync } from './db';
import { TableInfoRow, UserRow } from './models';
import { User, UserAuthSource } from '@OpsiMate/shared';

export class UserRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async initUsersTable(): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `
				)
				.run();

			// Backward compatibility: ensure phone_number column exists
			const columns = this.db.prepare(`PRAGMA table_info(users)`).all() as TableInfoRow[];
			if (!columns.some((col) => col.name === 'phone_number')) {
				this.db.prepare(`ALTER TABLE users ADD COLUMN phone_number TEXT`).run();
			}
			// 'local' (bcrypt password here) or 'ldap' (password in the directory). Every
			// existing account is local.
			if (!columns.some((col) => col.name === 'auth_source')) {
				this.db.prepare(`ALTER TABLE users ADD COLUMN auth_source TEXT NOT NULL DEFAULT 'local'`).run();
			}
		});
	}

	async createUser(
		email: string,
		password_hash: string,
		full_name: string,
		role: 'admin' | 'editor' | 'viewer' | 'operation',
		authSource: UserAuthSource = 'local'
	): Promise<{ lastID: number }> {
		return runAsync<{ lastID: number }>(() => {
			const stmt = this.db.prepare(
				'INSERT INTO users (email, password_hash, full_name, role, auth_source) VALUES (?, ?, ?, ?, ?)'
			);
			const result = stmt.run(email, password_hash, full_name, role, authSource);
			return { lastID: result.lastInsertRowid as number };
		});
	}

	async loginVerification(email: string): Promise<{ user: User; passwordHash: string } | undefined> {
		return runAsync(() => {
			const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
			const userRow = stmt.get(email) as UserRow | undefined;
			return userRow ? { user: this.toSharedUser(userRow), passwordHash: userRow.password_hash } : undefined;
		});
	}

	async countUsers(): Promise<number> {
		return runAsync(() => {
			const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
			const row = stmt.get() as { count: number };
			return row.count;
		});
	}

	async updateUserRole(email: string, newRole: 'admin' | 'editor' | 'viewer' | 'operation'): Promise<void> {
		return runAsync(() => {
			const stmt = this.db.prepare('UPDATE users SET role = ? WHERE email = ?');
			stmt.run(newRole, email);
		});
	}

	async getAllUsers(): Promise<User[]> {
		return runAsync(() => {
			const stmt = this.db.prepare(
				'SELECT id, email, full_name, role, created_at, phone_number, auth_source FROM users'
			);
			const userRows = stmt.all() as UserRow[];
			return userRows.map(this.toSharedUser);
		});
	}

	async getUserById(id: number): Promise<User | null> {
		return runAsync(() => {
			const row = this.db
				.prepare(
					'SELECT id, email, full_name, role, created_at, phone_number, auth_source FROM users WHERE id = ?'
				)
				.get(id) as UserRow | undefined;
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

	async updateUser(userId: number, updates: { fullName?: string; email?: string; role?: string }): Promise<void> {
		return runAsync(() => {
			const setClauses: string[] = [];
			const values: (string | number)[] = [];

			if (updates.fullName !== undefined) {
				setClauses.push('full_name = ?');
				values.push(updates.fullName);
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
			const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`;
			const stmt = this.db.prepare(sql);
			stmt.run(...(values as [string | number, ...Array<string | number>]));
		});
	}

	private toSharedUser = (row: UserRow): User => {
		return {
			id: String(row.id),
			email: row.email,
			fullName: row.full_name,
			role: row.role,
			createdAt: row.created_at,
			phoneNumber: row.phone_number ?? null,
			authSource: row.auth_source === 'ldap' ? 'ldap' : 'local',
		};
	};

	// An LDAP login keeps the local copy in step with the directory: name and role
	// are the directory's on every login.
	async syncDirectoryUser(userId: number, fullName: string, role: string): Promise<void> {
		return runAsync(() => {
			this.db.prepare('UPDATE users SET full_name = ?, role = ? WHERE id = ?').run(fullName, role, userId);
		});
	}

	async getUserByEmail(email: string): Promise<User | null> {
		return runAsync(() => {
			const row = this.db
				.prepare(
					'SELECT id, email, full_name, role, created_at, phone_number, auth_source FROM users WHERE email = ?'
				)
				.get(email) as UserRow | undefined;
			return row ? this.toSharedUser(row) : null;
		});
	}
}
