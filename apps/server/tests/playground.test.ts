import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { SuperTest, Test } from 'supertest';
import { setupDB, setupExpressApp } from './setup';
import { MailClient } from '../src/dal/external-client/mail-client';

let app: SuperTest<Test>;
let db: Database.Database;

interface DemoRow {
	tracking_id: string | null;
	email: string | null;
}

beforeAll(async () => {
	db = await setupDB();
	// Avoid configuring a real SMTP transporter from a developer's local environment.
	// Mail failure behavior is exercised explicitly in its test below.
	const initializeMailClient = vi.spyOn(MailClient.prototype, 'initialize').mockResolvedValue();
	try {
		app = await setupExpressApp(db);
	} finally {
		initializeMailClient.mockRestore();
	}
});

afterAll(() => {
	db.close();
});

describe('POST /api/v1/playground/book-demo', () => {
	test('accepts a public request without an Authorization header', async () => {
		const response = await app.post('/api/v1/playground/book-demo').send({ trackingId: 'public-demo' });

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ success: true });
	});

	test('returns 400 when email is not a string', async () => {
		const response = await app.post('/api/v1/playground/book-demo').send({ email: 42 });

		expect(response.status).toBe(400);
		expect(response.body).toEqual({
			success: false,
			error: 'Email must be a string',
		});
	});

	test('stores a tracking-only request with a null email', async () => {
		const trackingId = 'tracking-only-demo';

		const response = await app.post('/api/v1/playground/book-demo').send({ trackingId });

		const row = db
			.prepare('SELECT email, tracking_id FROM playground_demos WHERE tracking_id = ?')
			.get(trackingId) as DemoRow | undefined;

		expect(response.status).toBe(200);
		expect(row).toEqual({ email: null, tracking_id: trackingId });
	});

	test('swallows a mail send failure and still records the request', async () => {
		const trackingId = 'mail-failure-demo';
		const sendMail = vi
			.spyOn(MailClient.prototype, 'sendMail')
			.mockRejectedValue(new Error('SMTP delivery failed'));

		try {
			const response = await app.post('/api/v1/playground/book-demo').send({ trackingId });

			const row = db
				.prepare('SELECT email, tracking_id FROM playground_demos WHERE tracking_id = ?')
				.get(trackingId) as DemoRow | undefined;

			expect(sendMail).toHaveBeenCalled();
			expect(response.status).toBe(200);
			expect(response.body).toEqual({ success: true });
			expect(row).toEqual({ email: null, tracking_id: trackingId });
		} finally {
			sendMail.mockRestore();
		}
	});

	// Keep this last because dropping the table affects the shared in-memory database.
	test('returns 500 when persistence fails', async () => {
		db.exec('DROP TABLE playground_demos');

		const response = await app.post('/api/v1/playground/book-demo').send({ trackingId: 'repository-error-demo' });

		expect(response.status).toBe(500);
		expect(response.body).toEqual({
			success: false,
			error: 'Internal server error',
		});
	});
});
