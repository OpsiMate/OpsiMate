import Database from 'better-sqlite3';
import { describe, expect, test, vi } from 'vitest';
import { AuditBL } from '../src/bl/audit/audit.bl';
import { UserBL } from '../src/bl/users/user.bl';
import { AuditLogRepository } from '../src/dal/auditLogRepository';
import { MailClient, MailType } from '../src/dal/external-client/mail-client';
import { PasswordResetsRepository } from '../src/dal/passwordResetsRepository';
import { UserRepository } from '../src/dal/userRepository';

interface PasswordResetTokenRow {
	token_hash: string;
}

interface SentMailOptions {
	token?: string;
}

async function createRepositories() {
	const db = new Database(':memory:');
	const userRepo = new UserRepository(db);
	const passwordResetsRepo = new PasswordResetsRepository(db);
	const auditLogRepo = new AuditLogRepository(db);

	await Promise.all([
		userRepo.initUsersTable(),
		passwordResetsRepo.initPasswordResetsTable(),
		auditLogRepo.initAuditLogsTable(),
	]);

	return { db, userRepo, passwordResetsRepo, auditBL: new AuditBL(auditLogRepo) };
}

describe('forgot password mail failures', () => {
	test('rejects when the SMTP transporter is not configured', async () => {
		const mailClient = new MailClient();

		await expect(
			mailClient.sendMail({
				to: 'user@example.test',
				mailType: MailType.PASSWORD_RESET,
				token: 'reset-token',
			})
		).rejects.toThrow('SMTP transporter is not configured');
	});

	test('removes a newly created reset token when sending the email rejects', async () => {
		const { db, userRepo, passwordResetsRepo, auditBL } = await createRepositories();
		const user = await userRepo.createUser('user@example.test', 'password-hash', 'Test User', 'admin');
		let tokenHashAtSend: string | undefined;
		const mailClient = {
			sendMail: vi.fn(async () => {
				const record = db
					.prepare('SELECT token_hash FROM password_resets WHERE user_id = ?')
					.get(user.lastID) as PasswordResetTokenRow | undefined;
				tokenHashAtSend = record?.token_hash;
				throw new Error('SMTP delivery failed');
			}),
		} as unknown as MailClient;
		const userBL = new UserBL(userRepo, mailClient, passwordResetsRepo, auditBL);

		try {
			await expect(userBL.forgotPassword('user@example.test')).rejects.toThrow(
				'Failed to send password reset email. Please try again later.'
			);

			expect(tokenHashAtSend).toBeDefined();
			expect(await passwordResetsRepo.getPasswordResetByTokenHash(tokenHashAtSend!)).toBeNull();
		} finally {
			db.close();
		}
	});

	test('keeps a newer reset token when an earlier email send fails', async () => {
		const { db, userRepo, passwordResetsRepo, auditBL } = await createRepositories();
		await userRepo.createUser('user@example.test', 'password-hash', 'Test User', 'admin');
		let resolveFirstMailStarted: () => void;
		const firstMailStarted = new Promise<void>((resolve) => {
			resolveFirstMailStarted = resolve;
		});
		let rejectFirstMail: (reason?: unknown) => void;
		const firstMailPending = new Promise<void>((_, reject) => {
			rejectFirstMail = reject;
		});
		const firstMailClient = {
			sendMail: vi.fn(async () => {
				resolveFirstMailStarted();
				await firstMailPending;
			}),
		} as unknown as MailClient;
		let secondToken: string | undefined;
		const secondMailClient = {
			sendMail: vi.fn(async (options: SentMailOptions) => {
				secondToken = options.token;
			}),
		} as unknown as MailClient;
		const firstUserBL = new UserBL(userRepo, firstMailClient, passwordResetsRepo, auditBL);
		const secondUserBL = new UserBL(userRepo, secondMailClient, passwordResetsRepo, auditBL);

		try {
			const firstRequest = firstUserBL.forgotPassword('user@example.test');
			await firstMailStarted;
			await secondUserBL.forgotPassword('user@example.test');
			rejectFirstMail(new Error('SMTP delivery failed'));

			await expect(firstRequest).rejects.toThrow('Failed to send password reset email. Please try again later.');
			expect(secondToken).toBeDefined();
			await expect(secondUserBL.validateResetPasswordToken(secondToken!)).resolves.toBe(true);
		} finally {
			db.close();
		}
	});

	test('registers successfully when a non-blocking welcome email rejects', async () => {
		const { db, userRepo, passwordResetsRepo, auditBL } = await createRepositories();
		const mailClient = {
			sendMail: vi.fn().mockRejectedValue(new Error('SMTP delivery failed')),
		} as unknown as MailClient;
		const userBL = new UserBL(userRepo, mailClient, passwordResetsRepo, auditBL);

		try {
			await expect(userBL.register('user@example.test', 'Test User', 'password')).resolves.toMatchObject({
				email: 'user@example.test',
			});
			expect(mailClient.sendMail).toHaveBeenCalledWith({
				to: 'user@example.test',
				mailType: MailType.WELCOME,
				userName: 'Test User',
			});
		} finally {
			db.close();
		}
	});
});
