import Database from 'better-sqlite3';
import { runAsync } from './db';
import {UserRow} from './models';
import {User} from "@service-peek/shared";

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
                    role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();
        });
    }

    async createUser(email: string, password_hash: string, full_name: string, role: 'admin' | 'editor' | 'viewer'): Promise<{ lastID: number }> {
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

    async updateUserRole(email: string, newRole: 'admin' | 'editor' | 'viewer'): Promise<void> {
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