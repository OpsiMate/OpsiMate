import Database from 'better-sqlite3';
import {
	ALERT_CALLBACK_EVENTS,
	AlertCallback,
	AlertCallbackDeliveryStatus,
	AlertCallbackWithSecret,
	AlertCallbackEvent,
} from '@OpsiMate/shared';
import { runAsync } from './db';
import { InsertResult } from './models';

interface AlertCallbackRow {
	id: number;
	name: string;
	url: string;
	method: string;
	headers: string | null;
	body_template: string | null;
	events: string;
	enabled: number;
	secret: string;
	last_status: string | null;
	last_error: string | null;
	last_sent_at: string | null;
	created_at: string;
	updated_at: string;
}

export type CreateAlertCallbackInput = Omit<
	AlertCallbackWithSecret,
	'id' | 'createdAt' | 'updatedAt' | 'lastStatus' | 'lastError' | 'lastSentAt'
>;
export type UpdateAlertCallbackInput = Partial<CreateAlertCallbackInput>;

const KNOWN_EVENTS = new Set<string>(ALERT_CALLBACK_EVENTS);

const parseEvents = (raw: string): AlertCallbackEvent[] => {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((e): e is AlertCallbackEvent => typeof e === 'string' && KNOWN_EVENTS.has(e));
	} catch {
		return [];
	}
};

const parseHeaders = (raw: string | null): Record<string, string> | null => {
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
		const headers: Record<string, string> = {};
		for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
			if (typeof value === 'string') headers[key] = value;
		}
		return headers;
	} catch {
		return null;
	}
};

export class AlertCallbackRepository {
	constructor(private db: Database.Database) {}

	// The full row, secret included: for the dispatcher (which signs with it) and for the
	// two responses that hand the secret to the admin (create, rotate).
	private toSharedWithSecret = (row: AlertCallbackRow): AlertCallbackWithSecret => ({
		id: row.id,
		name: row.name,
		url: row.url,
		method: row.method === 'PUT' ? 'PUT' : 'POST',
		headers: parseHeaders(row.headers),
		bodyTemplate: row.body_template,
		events: parseEvents(row.events),
		enabled: row.enabled === 1,
		secret: row.secret,
		lastStatus: row.last_status === 'success' || row.last_status === 'error' ? row.last_status : null,
		lastError: row.last_error,
		lastSentAt: row.last_sent_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	});

	// What list and get return: everything but the secret.
	private toShared = (row: AlertCallbackRow): AlertCallback => {
		const { secret: _secret, ...callback } = this.toSharedWithSecret(row);
		return callback;
	};

	async initAlertCallbacksTable(): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`
					CREATE TABLE IF NOT EXISTS alert_callbacks (
						id            INTEGER PRIMARY KEY AUTOINCREMENT,
						name          TEXT NOT NULL,
						url           TEXT NOT NULL,
						method        TEXT NOT NULL DEFAULT 'POST',
						headers       TEXT,
						body_template TEXT,
						events        TEXT NOT NULL DEFAULT '[]',
						enabled       INTEGER NOT NULL DEFAULT 0,
						secret        TEXT NOT NULL,
						last_status   TEXT,
						last_error    TEXT,
						last_sent_at  DATETIME,
						created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
						updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
					)
				`
				)
				.run();
		});
	}

	async createAlertCallback(data: CreateAlertCallbackInput): Promise<InsertResult> {
		return runAsync(() => {
			const result = this.db
				.prepare(
					`INSERT INTO alert_callbacks (name, url, method, headers, body_template, events, enabled, secret)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					data.name,
					data.url,
					data.method,
					data.headers ? JSON.stringify(data.headers) : null,
					data.bodyTemplate ?? null,
					JSON.stringify(data.events),
					data.enabled ? 1 : 0,
					data.secret
				);
			return { lastID: result.lastInsertRowid as number };
		});
	}

	async getAllAlertCallbacks(): Promise<AlertCallback[]> {
		return runAsync(() => {
			const rows = this.db
				.prepare(`SELECT * FROM alert_callbacks ORDER BY created_at DESC, id DESC`)
				.all() as AlertCallbackRow[];
			return rows.map(this.toShared);
		});
	}

	async getEnabledAlertCallbacks(): Promise<AlertCallbackWithSecret[]> {
		return runAsync(() => {
			const rows = this.db
				.prepare(`SELECT * FROM alert_callbacks WHERE enabled = 1 ORDER BY id`)
				.all() as AlertCallbackRow[];
			return rows.map(this.toSharedWithSecret);
		});
	}

	async getAlertCallbackById(id: number): Promise<AlertCallback | undefined> {
		return runAsync(() => {
			const row = this.db.prepare(`SELECT * FROM alert_callbacks WHERE id = ?`).get(id) as
				AlertCallbackRow | undefined;
			return row ? this.toShared(row) : undefined;
		});
	}

	async getAlertCallbackWithSecret(id: number): Promise<AlertCallbackWithSecret | undefined> {
		return runAsync(() => {
			const row = this.db.prepare(`SELECT * FROM alert_callbacks WHERE id = ?`).get(id) as
				AlertCallbackRow | undefined;
			return row ? this.toSharedWithSecret(row) : undefined;
		});
	}

	async updateAlertCallback(id: number, data: UpdateAlertCallbackInput): Promise<void> {
		return runAsync(() => {
			const updates: string[] = [];
			const values: unknown[] = [];
			if (data.name !== undefined) {
				updates.push('name = ?');
				values.push(data.name);
			}
			if (data.url !== undefined) {
				updates.push('url = ?');
				values.push(data.url);
			}
			if (data.method !== undefined) {
				updates.push('method = ?');
				values.push(data.method);
			}
			if (data.headers !== undefined) {
				updates.push('headers = ?');
				values.push(data.headers ? JSON.stringify(data.headers) : null);
			}
			if (data.bodyTemplate !== undefined) {
				updates.push('body_template = ?');
				values.push(data.bodyTemplate);
			}
			if (data.events !== undefined) {
				updates.push('events = ?');
				values.push(JSON.stringify(data.events));
			}
			if (data.enabled !== undefined) {
				updates.push('enabled = ?');
				values.push(data.enabled ? 1 : 0);
			}
			if (data.secret !== undefined) {
				updates.push('secret = ?');
				values.push(data.secret);
			}
			if (updates.length === 0) return;
			updates.push('updated_at = CURRENT_TIMESTAMP');
			values.push(id);
			this.db.prepare(`UPDATE alert_callbacks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
		});
	}

	// The outcome of the latest delivery attempt, for the Settings list. A success clears
	// the previous error.
	async recordDelivery(id: number, status: AlertCallbackDeliveryStatus, error: string | null): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`UPDATE alert_callbacks SET last_status = ?, last_error = ?, last_sent_at = CURRENT_TIMESTAMP WHERE id = ?`
				)
				.run(status, status === 'success' ? null : error, id);
		});
	}

	async deleteAlertCallback(id: number): Promise<void> {
		return runAsync(() => {
			this.db.prepare(`DELETE FROM alert_callbacks WHERE id = ?`).run(id);
		});
	}
}
