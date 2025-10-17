import Database from 'better-sqlite3';
import { runAsync } from './db.js';
import {UserRow} from './models.js';
import {User} from "@OpsiMate/shared";

export class UserRepository {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    async initUsersTable(): Promise<void> {
        return runAsync(() => {
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer','noc')),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();
            const row = this.db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get() as { sql?: string } | undefined;
    const hasNoc = !!row?.sql?.includes(`'noc'`);
    if (!hasNoc) {
      this.db.exec('BEGIN');
      try {
        this.db.prepare(`
          CREATE TABLE users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer','noc')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();

        this.db.prepare(`
          INSERT INTO users_new (id,email,password_hash,full_name,role,created_at)
          SELECT id,email,password_hash,full_name,role,created_at FROM users
        `).run();

        this.db.prepare(`DROP TABLE users`).run();
        this.db.prepare(`ALTER TABLE users_new RENAME TO users`).run();

        this.db.exec('COMMIT');
      } catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
      }
    }
        });
    }

    async createUser(email: string, password_hash: string, full_name: string, role: 'admin' | 'editor' | 'viewer' |'noc'): Promise<{ lastID: number }> {
        return runAsync<{ lastID: number }>(() => {
            const stmt = this.db.prepare(
                'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)' 
            );
            const result = stmt.run(email, password_hash, full_name, role);
            return { lastID: result.lastInsertRowid as number };
        });
    }

    async loginVerification(email: string): Promise<{ user: User, passwordHash: string} | undefined> {
        return runAsync(() => {
            const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
            const userRow = stmt.get(email) as UserRow | undefined;
            return userRow ? { user: this.toSharedUser(userRow), passwordHash: userRow.password_hash} : undefined;
        });
    }

    async countUsers(): Promise<number> {
        return runAsync(() => {
            const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
            const row = stmt.get() as { count: number };
            return row.count;
        });
    }

    async updateUserRole(email: string, newRole: 'admin' | 'editor' | 'viewer'|'noc'): Promise<void> {
        return runAsync(() => {
            const stmt = this.db.prepare('UPDATE users SET role = ? WHERE email = ?');
            stmt.run(newRole, email);
        });
    }

    async getAllUsers(): Promise<User[]> {
        return runAsync(() => {
            const stmt = this.db.prepare('SELECT id, email, full_name, role, created_at FROM users');
            const userRows = stmt.all() as UserRow[];
            return userRows.map(this.toSharedUser);
        });
    }

    async getUserById(id: number): Promise<User | null> {
        return runAsync(() => {
            const row = this.db.prepare('SELECT id, email, full_name, role, created_at FROM users WHERE id = ?').get(id) as UserRow | undefined;
            return row ? this.toSharedUser(row) : null;
        });
    }

    async deleteUser(id: number): Promise<void> {
        return runAsync(() => {
            this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
        });
    }

    async updateUserProfile(id: number, fullName: string, passwordHash?: string): Promise<void> {
        return runAsync(() => {
            if (passwordHash) {
                const stmt = this.db.prepare('UPDATE users SET full_name = ?, password_hash = ? WHERE id = ?');
                stmt.run(fullName, passwordHash, id);
            } else {
                const stmt = this.db.prepare('UPDATE users SET full_name = ? WHERE id = ?');
                stmt.run(fullName, id);
            }
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
            id: row.id,
            email: row.email,
            fullName: row.full_name,
            role: row.role,
            createdAt: row.created_at
        };
    };
}