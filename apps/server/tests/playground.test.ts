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

	test.each([42, 0, null, false])('returns 400 when email is %s', async (email) => {
		const response = await app.post('/api/v1/playground/book-demo').send({ email });

		expect(response.status).toBe(400);
		expect(response.body).toEqual({
			success: false,
			error: 'Email must be a string',
		});
	});

	test('accepts a string email', async () => {
		const trackingId = 'valid-email-demo';

		const response = await app.post('/api/v1/playground/book-demo').send({
			email: 'garv@example.com',
			trackingId,
		});

		const row = db
			.prepare('SELECT email, tracking_id FROM playground_demos WHERE tracking_id = ?')
			.get(trackingId) as DemoRow | undefined;

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ success: true });
		expect(row).toEqual({ email: 'garv@example.com', tracking_id: trackingId });
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

	test('swallows the mail failure and still records the request', async () => {
		const trackingId = 'mail-failure-demo';
		const sendMail = vi
			.spyOn(MailClient.prototype, 'sendMail')
			.mockRejectedValue(new Error('Simulated mail failure'));

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

	test('returns 500 when persistence fails', async () => {
		const failureDb = await setupDB();
		let failureApp: SuperTest<Test>;

		const initializeMailClient = vi.spyOn(MailClient.prototype, 'initialize').mockResolvedValue();

		try {
			failureApp = await setupExpressApp(failureDb);
		} finally {
			initializeMailClient.mockRestore();
		}

		try {
			failureDb.exec('DROP TABLE playground_demos');

			const response = await failureApp
				.post('/api/v1/playground/book-demo')
				.send({ trackingId: 'repository-error-demo' });

			expect(response.status).toBe(500);
			expect(response.body).toEqual({
				success: false,
				error: 'Internal server error',
			});
		} finally {
			failureDb.close();
		}
	});
});
