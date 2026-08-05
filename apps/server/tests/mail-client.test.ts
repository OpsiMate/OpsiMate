import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MailClient, MailType } from '../src/dal/external-client/mail-client';

/**
 * This test demonstrates the use of MOCKS
 * Mock = A test double that records how it was called and allows verification
 *
 * Note: We directly mock the private properties of MailClient to demonstrate
 * how mocking works without complex module mocking setup.
 */
describe('MailClient with MOCKS', () => {
	let mailClient: MailClient;
	let mockTransporter: any;

	beforeEach(() => {
		// Create a mock transporter with spy functions
		mockTransporter = {
			verify: vi.fn().mockResolvedValue(true),
			sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
		};

		mailClient = new MailClient();
	});

	test('should send email with correct parameters using mock transporter', async () => {
		// Directly inject mock transporter into the private properties
		(mailClient as any).transporter = mockTransporter;
		(mailClient as any).verified = true;
		(mailClient as any).mailerConfig = {
			from: 'test@example.com',
			mailLinkBaseUrl: 'https://example.com',
		};

		await mailClient.sendMail({
			to: 'user@example.com',
			mailType: MailType.WELCOME,
			userName: 'Test User',
		});

		// Verify that sendMail was called exactly once
		expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

		// Verify the mock was called with correct parameters
		expect(mockTransporter.sendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'user@example.com',
				from: 'test@example.com',
				subject: expect.stringContaining('Welcome'),
			})
		);
	});

	test('should send password reset email with token', async () => {
		// Setup mock transporter
		(mailClient as any).transporter = mockTransporter;
		(mailClient as any).verified = true;
		(mailClient as any).mailerConfig = {
			from: 'noreply@example.com',
			mailLinkBaseUrl: 'https://example.com',
		};

		const resetToken = 'test-reset-token-123';

		await mailClient.sendMail({
			to: 'user@example.com',
			mailType: MailType.PASSWORD_RESET,
			userName: 'Test User',
			token: resetToken,
		});

		// Verify sendMail was called
		expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

		// Verify the email contains the reset token in the HTML
		const callArgs = mockTransporter.sendMail.mock.calls[0][0];
		expect(callArgs.html).toContain(encodeURIComponent(resetToken));
		expect(callArgs.subject).toContain('Password Reset');
	});

	test('should track multiple email sends using mock', async () => {
		// Setup mock transporter
		(mailClient as any).transporter = mockTransporter;
		(mailClient as any).verified = true;
		(mailClient as any).mailerConfig = {
			from: 'test@example.com',
			mailLinkBaseUrl: 'https://example.com',
		};

		// Send multiple emails
		await mailClient.sendMail({
			to: 'user1@example.com',
			mailType: MailType.WELCOME,
			userName: 'User One',
		});

		await mailClient.sendMail({
			to: 'user2@example.com',
			mailType: MailType.WELCOME,
			userName: 'User Two',
		});

		// Verify sendMail was called twice
		expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);

		// Verify first call
		expect(mockTransporter.sendMail).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ to: 'user1@example.com' })
		);

		// Verify second call
		expect(mockTransporter.sendMail).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ to: 'user2@example.com' })
		);
	});

	test('should not send email when transporter is not configured', async () => {
		// Set transporter to null to simulate unconfigured state
		(mailClient as any).transporter = null;
		(mailClient as any).verified = false;

		// The method catches the error and logs it, so it won't throw
		// We just verify it doesn't crash
		await mailClient.sendMail({
			to: 'user@example.com',
			mailType: MailType.WELCOME,
			userName: 'Test User',
		});

		// Verify sendMail was never called since transporter is null
		expect(mockTransporter.sendMail).not.toHaveBeenCalled();
	});
});
