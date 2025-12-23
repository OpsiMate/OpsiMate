import { UserRepository } from '../../dal/userRepository';
import bcrypt from 'bcrypt';
import { AuditActionType, AuditResourceType, Logger, Role, User } from '@OpsiMate/shared';
import { MailClient, MailType } from '../../dal/external-client/mail-client';
import { S3Client } from '../../dal/external-client/s3-client';
import { PasswordResetsRepository } from '../../dal/passwordResetsRepository';
import { AuditBL } from '../audit/audit.bl';
import { decryptPassword, generatePasswordResetInfo, hashString } from '../../utils/encryption';

const logger = new Logger('bl/users/user.bl');

export class UserBL {
	constructor(
		private userRepo: UserRepository,
		private mailClient: MailClient,
		private passwordResetsRepo: PasswordResetsRepository,
		private auditBL: AuditBL,
		private s3Client?: S3Client
	) {}

	async register(email: string, fullName: string, password: string): Promise<User> {
		const userCount = await this.userRepo.countUsers();
		if (userCount > 0) {
			throw new Error('Registration is disabled after first admin');
		}
		const hash = await bcrypt.hash(password, 10);
		const result = await this.userRepo.createUser(email, hash, fullName, 'admin');
		const user = await this.userRepo.getUserById(result.lastID);
		if (!user) throw new Error('User creation failed');

		// Send welcome email
		void this.mailClient.sendMail({
			to: user.email,
			mailType: MailType.WELCOME,
			userName: user.fullName,
		});

		return user;
	}

	async createUser(email: string, fullName: string, password: string, role: Role): Promise<User> {
		const hash = await bcrypt.hash(password, 10);
		const result = await this.userRepo.createUser(email, hash, fullName, role);
		const user = await this.userRepo.getUserById(result.lastID);
		if (!user) throw new Error('User creation failed');
		return user;
	}

	async updateUserRole(email: string, newRole: Role): Promise<void> {
		await this.userRepo.updateUserRole(email, newRole);
	}

	async login(email: string, password: string): Promise<User> {
		const user = await this.userRepo.loginVerification(email);
		if (!user) {
			throw new Error('Invalid email or password');
		}
		const valid = await bcrypt.compare(password, user.passwordHash);
		if (!valid) {
			throw new Error('Invalid email or password');
		}
		return user.user;
	}

	async resetUserPassword(userId: number, newPassword: string): Promise<void> {
		const hashedPassword = await bcrypt.hash(newPassword, 10);
		await this.userRepo.updateUserPassword(userId, hashedPassword);
	}

	async updateUser(userId: number, updates: { fullName?: string; email?: string; role?: Role }): Promise<User> {
		await this.userRepo.updateUser(userId, updates);
		const updatedUser = await this.userRepo.getUserById(userId);
		if (!updatedUser) {
			throw new Error('User not found');
		}
		return updatedUser;
	}

	async getAllUsers(): Promise<User[]> {
		const users = await this.userRepo.getAllUsers();
		return await this.populateAvatarUrls(users);
	}

	async deleteUser(id: number): Promise<void> {
		await this.userRepo.deleteUser(id);
	}

	async getUserById(id: number): Promise<User | null> {
		const user = await this.userRepo.getUserById(id);
		if (!user) return null;
		return await this.populateAvatarUrl(user);
	}

	/**
	 * Returns true if any users exist in the database, otherwise false.
	 */
	async usersExist(): Promise<boolean> {
		const count = await this.userRepo.countUsers();
		return count > 0;
	}

	async updateProfile(id: number, fullName: string, newPassword?: string): Promise<User> {
		let passwordHash: string | undefined;
		if (newPassword) {
			passwordHash = await bcrypt.hash(newPassword, 10);
		}

		await this.userRepo.updateUserProfile(id, fullName, passwordHash);
		const updatedUser = await this.userRepo.getUserById(id);
		if (!updatedUser) {
			throw new Error('User not found');
		}
		return updatedUser;
	}

	async forgotPassword(email: string): Promise<void> {
		const user = await this.userRepo.getUserByEmail(email);
		if (!user) {
			logger.info('Password reset requested for non-existent email');
			return;
		}

		try {
			const resetPasswordConfig = generatePasswordResetInfo();
			await this.passwordResetsRepo.createPasswordResetToken({
				userId: user.id,
				tokenHash: resetPasswordConfig.tokenHash,
				expiresAt: resetPasswordConfig.expiresAt,
			});

			void this.mailClient.sendMail({
				to: user.email,
				subject: 'Password Reset Request',
				mailType: MailType.PASSWORD_RESET,
				token: resetPasswordConfig.encryptedToken,
				userName: user.fullName,
			});
		} catch (error) {
			logger.error('Failed to send password reset email', error);
			await this.passwordResetsRepo.deletePasswordResetsByUserId(user.id);
			throw new Error('Failed to send password reset email. Please try again later.');
		}
	}

	async validateResetPasswordToken(token: string): Promise<boolean> {
		if (!token) {
			return false;
		}

		const decryptedToken = decryptPassword(token);
		if (!decryptedToken) {
			return false;
		}

		const tokenHash = hashString(decryptedToken);
		const record = await this.passwordResetsRepo.getPasswordResetByTokenHash(tokenHash);

		if (!record) {
			return false;
		}

		const now = new Date();
		const expiresAt = new Date(record.expiresAt);
		if (expiresAt < now) {
			return false;
		}

		return true;
	}

	async resetPassword(token: string, newPassword: string): Promise<void> {
		try {
			const decryptedToken = decryptPassword(token);
			const tokenHash = hashString(decryptedToken!);
			const resetPassword = await this.passwordResetsRepo.getPasswordResetByTokenHash(tokenHash);

			if (!resetPassword) {
				throw new Error('Invalid or expired token');
			}

			const now = new Date();
			const expiresAt = new Date(resetPassword.expiresAt);
			if (expiresAt < now) {
				try {
					await this.passwordResetsRepo.deletePasswordResetsByUserId(resetPassword.userId);
				} catch (err) {
					logger.error('Failed to delete expired password reset token(s)', err);
				}
				throw new Error('Invalid or expired token');
			}

			const user = await this.userRepo.getUserById(resetPassword.userId);

			if (!user) {
				throw new Error('User not found');
			}

			const userLoginInfo = await this.userRepo.loginVerification(user.email);
			if (!userLoginInfo) {
				throw new Error('User login info not found');
			}

			const isSamePassword = await bcrypt.compare(newPassword, userLoginInfo.passwordHash);

			if (isSamePassword) {
				throw new Error('You cannot reuse an old password');
			}

			await this.resetUserPassword(user.id, newPassword);
			await this.passwordResetsRepo.deletePasswordResetsByUserId(user.id);

			await this.auditBL.logAction({
				actionType: AuditActionType.UPDATE,
				resourceType: AuditResourceType.USER,
				resourceId: String(user.id),
				userId: user.id,
				userName: user.fullName,
				resourceName: user.email,
				details: 'User reset their password via email link',
			});
		} catch (error) {
			logger.error(`Error resetting password for user`, error);
			throw error;
		}
	}

	// Avatar-related methods

	/**
	 * Generates a presigned URL for uploading an avatar.
	 * @param userId - The user's ID
	 * @param contentType - The MIME type of the file (image/jpeg or image/png)
	 * @returns Object containing uploadUrl and key
	 */
	async getAvatarUploadUrl(userId: string, contentType: string): Promise<{ uploadUrl: string; key: string }> {
		if (!this.s3Client || !this.s3Client.isReady()) {
			throw new Error('Storage service is not available');
		}

		if (!this.s3Client.isValidContentType(contentType)) {
			throw new Error('Invalid content type. Only JPEG and PNG images are allowed.');
		}

		return await this.s3Client.generateUploadUrl(userId, contentType);
	}

	/**
	 * Confirms avatar upload by saving the avatar key to the database.
	 * Also deletes the old avatar from S3 if it exists.
	 * @param userId - The user's ID
	 * @param avatarKey - The S3 key of the uploaded avatar
	 */
	async confirmAvatarUpload(userId: number, avatarKey: string): Promise<User> {
		if (!this.s3Client || !this.s3Client.isReady()) {
			throw new Error('Storage service is not available');
		}

		// Get the old avatar key to delete it later
		const oldAvatarKey = await this.userRepo.getAvatarKey(userId);

		// Update the user's avatar key in the database
		await this.userRepo.updateAvatarKey(userId, avatarKey);

		// Delete the old avatar from S3 if it exists
		if (oldAvatarKey) {
			try {
				// Invalidate the cached URL for the old avatar
				this.s3Client.invalidateCachedUrl(oldAvatarKey);
				await this.s3Client.deleteObject(oldAvatarKey);
				logger.info(`Deleted old avatar for user ${userId}: ${oldAvatarKey}`);
			} catch (error) {
				// Log but don't fail the operation if delete fails
				logger.warn(
					`Failed to delete old avatar for user ${userId}: ${oldAvatarKey} - ${(error as Error).message}`
				);
			}
		}

		const updatedUser = await this.userRepo.getUserById(userId);
		if (!updatedUser) {
			throw new Error('User not found');
		}

		return await this.populateAvatarUrl(updatedUser);
	}

	/**
	 * Deletes the user's avatar from S3 and removes the avatar key from the database.
	 * @param userId - The user's ID
	 */
	async deleteAvatar(userId: number): Promise<User> {
		if (!this.s3Client || !this.s3Client.isReady()) {
			throw new Error('Storage service is not available');
		}

		const avatarKey = await this.userRepo.getAvatarKey(userId);

		if (avatarKey) {
			try {
				// Invalidate the cached URL
				this.s3Client.invalidateCachedUrl(avatarKey);
				await this.s3Client.deleteObject(avatarKey);
				logger.info(`Deleted avatar for user ${userId}: ${avatarKey}`);
			} catch (error) {
				logger.warn(
					`Failed to delete avatar from S3 for user ${userId}: ${avatarKey} - ${(error as Error).message}`
				);
			}
		}

		// Remove the avatar key from the database
		await this.userRepo.updateAvatarKey(userId, null);

		const updatedUser = await this.userRepo.getUserById(userId);
		if (!updatedUser) {
			throw new Error('User not found');
		}

		return updatedUser;
	}

	/**
	 * Populates the avatarUrl for a single user.
	 */
	private async populateAvatarUrl(user: User): Promise<User> {
		if (!user.avatarKey || !this.s3Client || !this.s3Client.isReady()) {
			return user;
		}

		try {
			const avatarUrl = await this.s3Client.generateViewUrl(user.avatarKey);
			return { ...user, avatarUrl };
		} catch (error) {
			logger.warn(`Failed to generate avatar URL for user ${user.id}: ${(error as Error).message}`);
			return user;
		}
	}

	/**
	 * Populates the avatarUrl for multiple users.
	 */
	private async populateAvatarUrls(users: User[]): Promise<User[]> {
		if (!this.s3Client || !this.s3Client.isReady()) {
			return users;
		}

		return await Promise.all(users.map((user) => this.populateAvatarUrl(user)));
	}
}
