import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { SuperTest, Test } from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { AlertCommentsRepository } from '../src/dal/alertCommentsRepository';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';
import { User, AlertComment } from '@OpsiMate/shared';

async function createUserAndLogin(
	app: SuperTest<Test>,
	db: Database.Database,
	email: string,
	password: string,
	fullName: string
): Promise<string> {
	const passwordHash = await bcrypt.hash(password, 10);
	db.prepare('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(
		email,
		passwordHash,
		fullName,
		'editor'
	);

	const loginRes = await app.post('/api/v1/users/login').send({ email, password });
	if (loginRes.status !== 200 || !loginRes.body.token) {
		throw new Error(`Login failed for ${email}: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
	}

	return loginRes.body.token as string;
}

describe('/alerts/comments', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	let jwtToken: string;
	let commentsRepo: AlertCommentsRepository;

	beforeEach(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
		commentsRepo = new AlertCommentsRepository(db);
		jwtToken = await setupUserWithToken(app);
		const user = db.prepare('SELECT id FROM users WHERE email = ?').get('provideruser@example.com') as Pick<
			User,
			'id'
		>;
		const userId = String(user.id);

		const insertAlert = db.prepare(`
            INSERT INTO alerts (
                id, status, severity, tags, starts_at, updated_at,
                alert_url, alert_name, summary, is_dismissed
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

		insertAlert.run(
			'an-1',
			'firing',
			'warning',
			'{}',
			'2026-08-10T00:00:00.000Z',
			'2026-08-10T00:00:00.000Z',
			'https://x',
			'Analytics probe',
			'S',
			0
		);

		insertAlert.run(
			'an-2',
			'firing',
			'warning',
			'{}',
			'2026-08-11T00:00:00.000Z',
			'2026-08-11T00:00:00.000Z',
			'https://x',
			'Analytics probe',
			'S',
			0
		);

		insertAlert.run(
			'an-3',
			'firing',
			'warning',
			'{}',
			'2026-08-12T00:00:00.000Z',
			'2026-08-12T00:00:00.000Z',
			'https://x',
			'Analytics probe',
			'S',
			0
		);

		const insertComment = db.prepare(`
            INSERT INTO alert_comments (
                id, alert_id, user_id, comment, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `);

		insertComment.run(
			'cm-1',
			'an-1',
			userId,
			'First comment',
			'2026-08-10T00:00:00.000Z',
			'2026-08-10T00:00:00.000Z'
		);

		insertComment.run(
			'cm-2',
			'an-1',
			userId,
			'Second comment',
			'2026-08-12T00:00:00.000Z',
			'2026-08-12T00:00:00.000Z'
		);

		insertComment.run(
			'cm-3',
			'an-2',
			userId,
			'Third comment',
			'2026-08-13T00:00:00.000Z',
			'2026-08-13T00:00:00.000Z'
		);
		insertComment.run(
			'cm-4',
			'an-1',
			userId,
			'Fourth comment',
			'2026-08-11T00:00:00.000Z',
			'2026-08-11T00:00:00.000Z'
		);
	});

	describe('PATCH /api/v1/alerts/comments/:commentId', () => {
		test('author can update their comment and updatedAt advances', async () => {
			const commentRes = await app.get('/api/v1/alerts/an-1/comments').set('Authorization', `Bearer ${jwtToken}`);
			const originalComment = commentRes.body.data.comments.find(
				(c: Pick<AlertComment, 'id'>) => c.id === 'cm-1'
			);
			const originalUpdatedAt = new Date(originalComment.updatedAt).getTime();

			const res = await app
				.patch('/api/v1/alerts/comments/cm-1')
				.send({ comment: 'Updated comment' })
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(res.status).toBe(200);
			expect(res.body.data.comment.comment).toBe('Updated comment');
			expect(new Date(res.body.data.comment.updatedAt).getTime()).toBeGreaterThan(originalUpdatedAt);
		});

		test('rejects PATCH by a different user', async () => {
			const otherUserToken = await createUserAndLogin(
				app,
				db,
				'other-user@example.com',
				'other-password',
				'Other User'
			);
			const res = await app
				.patch('/api/v1/alerts/comments/cm-1')
				.send({ comment: 'Updated comment' })
				.set('Authorization', `Bearer ${otherUserToken}`);

			expect(res.status).toBe(500);
		});

		test('returns 404 for an unknown comment id', async () => {
			const res = await app
				.patch('/api/v1/alerts/comments/x')
				.send({ comment: 'Updated comment' })
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(res.status).toBe(404);
		});
	});

	describe('DELETE /api/v1/alerts/comments/:commentId', () => {
		test('returns expected behaviour for an unknown comment id', async () => {
			const res = await app.delete('/api/v1/alerts/comments/x').set('Authorization', `Bearer ${jwtToken}`);
			expect(res.status).toBe(200);
		});

		test('deletion by a non-author leaves comment in place', async () => {
			const otherUserToken = await createUserAndLogin(
				app,
				db,
				'delete-other-user@example.com',
				'other-password',
				'Delete Other User'
			);
			const res = await app
				.delete('/api/v1/alerts/comments/cm-1')
				.set('Authorization', `Bearer ${otherUserToken}`);
			expect(res.status).toBe(500);
			const commentRes = await app.get('/api/v1/alerts/an-1/comments').set('Authorization', `Bearer ${jwtToken}`);
			const originalComment = commentRes.body.data.comments.some(
				(c: Pick<AlertComment, 'id'>) => c.id === 'cm-1'
			);
			expect(originalComment).toBe(true);
		});
	});

	describe('GET /api/v1/alerts/:alertId/comments', () => {
		test('returns comments newest first', async () => {
			const res = await app.get('/api/v1/alerts/an-1/comments').set('Authorization', `Bearer ${jwtToken}`);
			expect(res.status).toBe(200);
			expect(res.body.data.comments).toHaveLength(3);
			expect(res.body.data.comments[0].id).toBe('cm-2');
			expect(res.body.data.comments[1].id).toBe('cm-4');
			expect(res.body.data.comments[2].id).toBe('cm-1');
		});
	});

	describe('Comment repository', () => {
		test('getLatestCommentsByAlertIds returns an empty object for an empty array', async () => {
			const latest = await commentsRepo.getLatestCommentsByAlertIds([]);
			expect(latest).toEqual({});
		});

		test('deleteCommentsByAlertId only removes comments belonging to the specified alert', async () => {
			await commentsRepo.deleteCommentsByAlertId('an-1');

			const remainingForAlert1 = await commentsRepo.getCommentsByAlertId('an-1');
			const remainingForAlert2 = await commentsRepo.getCommentsByAlertId('an-2');

			expect(remainingForAlert1).toHaveLength(0);
			expect(remainingForAlert2).toHaveLength(1);
		});
	});
});
