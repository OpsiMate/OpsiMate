import { vi } from 'vitest';
import Database from 'better-sqlite3';
import { createApp } from '../src/app.ts';
import request, { SuperTest, Test } from 'supertest';

// Mock the Kubernetes client to avoid ES module issues
vi.mock('@kubernetes/client-node', () => ({
	KubeConfig: vi.fn().mockImplementation(() => ({
		loadFromDefault: vi.fn(),
		loadFromFile: vi.fn(),
		makeApiClient: vi.fn(),
	})),
	CoreV1Api: vi.fn(),
	AppsV1Api: vi.fn(),
	NetworkingV1Api: vi.fn(),
}));

// Increase timeout for integration tests
vi.setConfig({ testTimeout: 30000 });

export function setupDB(): Database.Database {
	const db = new Database(':memory:');
	db.exec(`
        CREATE TABLE IF NOT EXISTS providers
        (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_name        TEXT NOT NULL,
            provider_ip          TEXT     DEFAULT NULL,
            username             TEXT     DEFAULT NULL,
            private_key_filename TEXT,
            password             TEXT,
            ssh_port             INTEGER  DEFAULT 22,
            created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
            provider_type        TEXT NOT NULL
                CHECK (
                    (private_key_filename IS NOT NULL AND TRIM(private_key_filename) <> '')
                        OR
                    (password IS NOT NULL AND TRIM(password) <> '')
                    )
        );
        CREATE TABLE IF NOT EXISTS users
        (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name     TEXT NOT NULL,
            role          TEXT NOT NULL,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS audit_logs
        (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            action_type   TEXT    NOT NULL,
            resource_type TEXT    NOT NULL,
            resource_id   TEXT    NOT NULL,
            user_id       INTEGER NOT NULL,
            user_name     TEXT,
            resource_name TEXT,
            timestamp     DATETIME DEFAULT CURRENT_TIMESTAMP,
            details       TEXT
        );
        CREATE TABLE IF NOT EXISTS services
        (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_id  INTEGER NOT NULL,
            service_name TEXT    NOT NULL,
            service_type TEXT    NOT NULL,
            status       TEXT,
            last_checked DATETIME,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (provider_id) REFERENCES providers (id)
        );
    `);
	return db;
}

export async function setupExpressApp(db: Database.Database): Promise<SuperTest<Test>> {
	const expressApp = await createApp(db);
	return request(expressApp) as unknown as SuperTest<Test>;
}

export async function setupUserWithToken(app: SuperTest<Test>): Promise<string> {
	// Register and login a user to get a JWT token
	await app.post('/api/v1/users/register').send({
		email: 'provideruser@example.com',
		fullName: 'Provider User',
		password: 'testpassword',
	});
	const loginRes = await app.post('/api/v1/users/login').send({
		email: 'provideruser@example.com',
		password: 'testpassword',
	});
	return loginRes.body.token as string;
}
