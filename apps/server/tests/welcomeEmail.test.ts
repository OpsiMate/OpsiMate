import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { SuperTest, Test } from 'supertest';
import { Role } from '@OpsiMate/shared';
import { AuditBL } from '../src/bl/audit/audit.bl';
import { UserBL } from '../src/bl/users/user.bl';
import { AuditLogRepository } from '../src/dal/auditLogRepository';
import { MailClient, MailType } from '../src/dal/external-client/mail-client';
import { PasswordResetsRepository } from '../src/dal/passwordResetsRepository';
import { UserRepository } from '../src/dal/userRepository';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

interface CreatedUserData {
	email: string;
	fullName: string;
	role: string;
}

interface CreatedUserResponse {
	success: boolean;
	data: CreatedUserData;
}

interface WelcomeMailOptions {
	to: string;
	mailType: MailType;
	userName: string;
}

interface WelcomeMailClient {
	sendMail: (options: WelcomeMailOptions) => Promise<void>;
}

const NEW_USER_EMAIL = 'created@example.com';
const NEW_USER_NAME = 'Created User';
const NEW_USER_PASSWORD = 'Password123';

async function createUserBl(sendMail: WelcomeMailClient['sendMail']) {
	const db = new Database(':memory:');
	const userRepo = new UserRepository(db);
	const passwordResetsRepo = new PasswordResetsRepository(db);
	const auditLogRepo = new AuditLogRepository(db);

	await Promise.all([
		userRepo.initUsersTable(),
		passwordResetsRepo.initPasswordResetsTable(),
		auditLogRepo.initAuditLogsTable(),
	]);

	const mailClient = { sendMail } as unknown as MailClient;
	const userBL = new UserBL(userRepo, mailClient, passwordResetsRepo, new AuditBL(auditLogRepo));
	return { db, userRepo, userBL };
}

describe('welcome email after admin user creation', () => {
	test('sends the welcome template to the new user without waiting for delivery', async () => {
		let releaseMail: () => void = () => undefined;
		const mailPending = new Promise<void>((resolve) => {
			releaseMail = resolve;
		});
		const sendMail = vi.fn(() => mailPending);
		const { db, userBL } = await createUserBl(sendMail);

		try {
			const created = await userBL.createUser(
				{ email: NEW_USER_EMAIL, fullName: NEW_USER_NAME, password: NEW_USER_PASSWORD },
				Role.Viewer
			);

			expect(created.email).toBe(NEW_USER_EMAIL);
			expect(created.fullName).toBe(NEW_USER_NAME);
			expect(sendMail).toHaveBeenCalledTimes(1);
			expect(sendMail).toHaveBeenCalledWith({
				to: NEW_USER_EMAIL,
				mailType: MailType.WELCOME,
				userName: NEW_USER_NAME,
			});
		} finally {
			releaseMail();
			db.close();
		}
	});

	test('keeps the account when the welcome email rejects', async () => {
		const sendMail = vi.fn().mockRejectedValue(new Error('SMTP delivery failed'));
		const { db, userRepo, userBL } = await createUserBl(sendMail);

		try {
			const created = await userBL.createUser(
				{ email: NEW_USER_EMAIL, fullName: NEW_USER_NAME, password: NEW_USER_PASSWORD },
				Role.Editor
			);
			const stored = await userRepo.getUserById(Number(created.id));

			expect(created.email).toBe(NEW_USER_EMAIL);
			expect(stored?.email).toBe(NEW_USER_EMAIL);
			expect(stored?.fullName).toBe(NEW_USER_NAME);
			expect(sendMail).toHaveBeenCalledWith({
				to: NEW_USER_EMAIL,
				mailType: MailType.WELCOME,
				userName: NEW_USER_NAME,
			});
		} finally {
			db.close();
		}
	});
});

describe('POST /api/v1/users welcome email', () => {
	let app: SuperTest<Test>;
	let adminToken: string;
	let sendMail: ReturnType<typeof vi.spyOn>;

	beforeAll(async () => {
		const db = await setupDB();
		app = await setupExpressApp(db);
		sendMail = vi.spyOn(MailClient.prototype, 'sendMail').mockResolvedValue(undefined);
		adminToken = await setupUserWithToken(app);
	});

	afterAll(() => {
		sendMail.mockRestore();
	});

	test('returns 201 when welcome email delivery fails', async () => {
		sendMail.mockClear();
		sendMail.mockRejectedValue(new Error('SMTP delivery failed'));

		const res = await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
			email: NEW_USER_EMAIL,
			fullName: NEW_USER_NAME,
			password: NEW_USER_PASSWORD,
			role: 'viewer',
		});

		const body = res.body as CreatedUserResponse;
		expect(res.status).toBe(201);
		expect(body.success).toBe(true);
		expect(body.data.email).toBe(NEW_USER_EMAIL);
		expect(body.data.fullName).toBe(NEW_USER_NAME);
		expect(sendMail).toHaveBeenCalledTimes(1);
		expect(sendMail).toHaveBeenCalledWith({
			to: NEW_USER_EMAIL,
			mailType: MailType.WELCOME,
			userName: NEW_USER_NAME,
		});
	});
});
