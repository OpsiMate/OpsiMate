import Database from 'better-sqlite3';
import { runAsync } from './db';
import {Integration, IntegrationType} from '@OpsiMate/shared';
import { IntegrationRow } from './models';
import {decryptPassword, encryptPassword} from "../utils/encryption.js";

const mapRowToIntegration = (row: IntegrationRow): Integration => ({
    id: row.id,
    name: row.name,
    type: row.type,
    externalUrl: row.external_url,
    credentials: JSON.parse(decryptPassword(row.credentials) as string) as Record<string, unknown>,
    createdAt: row.created_at,
});

export class IntegrationRepository {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    async createIntegration(data: Omit<Integration, 'id' | 'createdAt'>): Promise<{ lastID: number }> {
        return await runAsync(() => {
            const stmt = this.db.prepare(`
                INSERT INTO integrations (name, type, external_url, credentials)
                VALUES (?, ?, ?, ?)
            `);
            const result = stmt.run(
                data.name,
                data.type,
                data.externalUrl,
                encryptPassword(JSON.stringify(data.credentials))
            );
            return { lastID: result.lastInsertRowid as number };
        });
    }

    async getIntegrationById(id: number): Promise<Integration> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT id, name, type, external_url, credentials, created_at
                FROM integrations
                WHERE id = ?
            `);
            const row = stmt.get(id) as IntegrationRow;
            return mapRowToIntegration(row);
        });
    }

    async getIntegrationByType(type: IntegrationType): Promise<Integration | undefined> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT id, name, type, external_url, credentials, created_at
                FROM integrations
                WHERE type = ?
                LIMIT 1
            `);
            const row = stmt.get(type) as IntegrationRow | undefined;
            return row ? mapRowToIntegration(row) : undefined;
        });
    }

    async getAllIntegrations(): Promise<Integration[]> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT id, name, type, external_url, credentials, created_at
                FROM integrations
                ORDER BY created_at DESC
            `);
            const rows = stmt.all() as IntegrationRow[];
            return rows.map(mapRowToIntegration);
        });
    }

    async deleteIntegration(id: number): Promise<void> {
        return runAsync(() => {
            const stmt = this.db.prepare('DELETE FROM integrations WHERE id = ?');
            stmt.run(id);
        });
    }

    async updateIntegration(id: number, data: Omit<Integration, 'id' | 'createdAt'>): Promise<void> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                UPDATE integrations
                SET name = ?, type = ?, external_url = ?, credentials = ?
                WHERE id = ?
            `);
            stmt.run(
                data.name,
                data.type,
                data.externalUrl,
                encryptPassword(JSON.stringify(data.credentials)),
                id
            );
        });
    }

    async initIntegrationsTable(): Promise<void> {
        return runAsync(() => {
            // Create table with Kibana support directly - no need for backward compatibility
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS integrations
                (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    name         TEXT NOT NULL,
                    type         TEXT NOT NULL CHECK (type IN ('Grafana', 'Prometheus', 'Coralogix', 'Kibana', 'Datadog')),
                    external_url TEXT NOT NULL,
                    credentials  JSON NOT NULL,
                    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `).run();
        });
    }
}
