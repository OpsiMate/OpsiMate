import { UserRepository, UserUpdates } from '../../dal/userRepository';
import bcrypt from 'bcrypt';
import { AuditActionType, AuditResourceType, Logger, Role, User, usernameFromEmail } from '@OpsiMate/shared';
import { MailClient, MailType } from '../../dal/external-client/mail-client';
import { PasswordResetsRepository } from '../../dal/passwordResetsRepository';
import { AuditBL } from '../audit/audit.bl';
import { decryptPassword, generatePasswordResetInfo, hashString } from '../../utils/encryption';
import { LdapAuthenticator } from './ldapAuthenticator';
import { LoginThrottle } from './loginThrottle';
import { MS_PER_MINUTE } from '../../utils/time';

// Work factor used for every password hash created by this module.
const BCRYPT_SALT_ROUNDS = 10;

export const INVALID_LOGIN = 'Invalid username or password';
export const USERNAME_TAKEN = 'Username already taken';
export const EMAIL_TAKEN = 'Email already registered';

// A new local account as the API describes it: a username, or only an email (older
// clients, scripts) from which the username is taken.
export interface NewAccount {
	username?: string;
	email?: string | null;
	fullName: string;
	password: string;
}

// The login name a new account gets: the one given, else the email's local part.
export const usernameFor = (account: { username?: string; email?: string | null }): string => {
	if (account.username) return account.username.trim().toLowerCase();
	if (account.email) return usernameFromEmail(account.email);
	throw new Error('A username or an email is required');
};

// A taken username or email, as the API reports it: SQLite's UNIQUE failures (the email
// column keeps its old constraint name; the username has a named index), or the same
// finding made before the write.
export const uniqueViolationMessage = (error: unknown): string | null => {
	const message = error instanceof Error ? error.message : '';
	if (message === USERNAME_TAKEN || message === EMAIL_TAKEN) return message;
	if (!message.includes('UNIQUE constraint failed')) return null;
	if (message.includes('users.email')) return EMAIL_TAKEN;
	if (message.includes('users_username_unique') || message.includes('users.username')) return USERNAME_TAKEN;
	return null;
};
export const NOT_ALLOWED_LOGIN = 'Your directory account is not allowed to use OpsiMate';
// Stored as password_hash for directory accounts: not a bcrypt hash, so bcrypt.compare
// is false for every input — the account can only sign in through LDAP.
const DIRECTORY_PASSWORD_HASH = '!ldap';

// A change OpsiMate cannot make for a directory (LDAP) account.
export class DirectoryManagedError extends Error {
	constructor(what: string) {
		super(`${what} is managed by your organization's directory (LDAP)`);
		this.name = 'DirectoryManagedError';
	}
}

// Too many failed directory logins for one email: refuse before asking the directory
// again. Each failure there counts toward the directory's own lockout policy (AD often
// locks an account after 5–10), which would lock the person out of everything, not
// just OpsiMate.
export class TooManyLoginAttemptsError extends Error {
	constructor() {
		super('Too many failed login attempts. Try again later.');
		this.name = 'TooManyLoginAttemptsError';
	}
}

export const DEFAULT_LDAP_MAX_FAILURES = 5;

// What was typed at login, as an email: a name without "@" becomes <name>@<default
// domain> when an installation has one. Anything with "@" (or no domain configured) is
// taken as typed. Since usernames exist this is a fallback (deprecated): a bare name is
// first a username, and only then, for installations that relied on it, an address.
export const completeLoginIdentifier = (identifier: string, defaultDomain: string | null | undefined): string => {
	const typed = identifier.trim();
	if (!defaultDomain || typed === '' || typed.includes('@')) return typed;
	return `${typed}@${defaultDomain}`;
};
const LDAP_FAILURE_WINDOW_MS = 15 * MS_PER_MINUTE;
// 65,536 buckets ≈ 768 KB, fixed.
const LDAP_FAILURE_BUCKETS = 1 << 16;

const logger = new Logger('bl/users/user.bl');

export class UserBL {
	// Notified after any write that changes who the users are or what they are called.
	// Wired in app.ts to invalidate AlertBL's owners snapshot (same pattern as the
	// mute/enrichment rule-change callbacks), so a rename or a new user is visible to
	// the alerts list's owner column, sort, and facets on the immediate next refetch
	// instead of after a TTL window. Password-only writes do not notify.
	private onUsersChanged: (() => void) | null = null;

	setOnUsersChanged(callback: () => void): void {
		this.onUsersChanged = callback;
	}

	// Directory login (see LdapAuthenticator); null when LDAP is not configured.
	private ldap: LdapAuthenticator | null = null;
	// Failed directory logins per email (lower-cased), in a fixed window.
	// null = no limit (login_max_failures: 0).
	private ldapFailures: LoginThrottle | null = null;
	private ldapMaxFailures = DEFAULT_LDAP_MAX_FAILURES;

	setLdapAuthenticator(ldap: LdapAuthenticator | null, maxFailures = DEFAULT_LDAP_MAX_FAILURES): void {
		this.ldap = ldap;
		if (maxFailures <= 0) {
			this.ldapFailures = null;
		} else if (!this.ldapFailures || maxFailures !== this.ldapMaxFailures) {
			// Any save that keeps the limit keeps the counters, including switching LDAP
			// off and on: re-saving must not hand an attacker a fresh set of guesses.
			this.ldapFailures = new LoginThrottle({
				maxFailures,
				windowMs: LDAP_FAILURE_WINDOW_MS,
				buckets: LDAP_FAILURE_BUCKETS,
			});
		}
		this.ldapMaxFailures = maxFailures;
	}

	constructor(
		private userRepo: UserRepository,
		private mailClient: MailClient,
		private passwordResetsRepo: PasswordResetsRepository,
		private auditBL: AuditBL,
		// See completeLoginIdentifier; null = login takes the full email only.
		private loginDefaultEmailDomain: string | null = null
	) {}

	async register(account: NewAccount): Promise<User> {
		const userCount = await this.userRepo.countUsers();
		if (userCount > 0) {
			throw new Error('Registration is disabled after first admin');
		}
		const user = await this.createLocalAccount(account, Role.Admin);

		// A welcome mail, when there is an address to send it to.
		if (user.email) {
			void this.mailClient
				.sendMail({
					to: user.email,
					mailType: MailType.WELCOME,
					userName: user.fullName,
				})
				.catch((error) => logger.error('Failed to send welcome email', error));
		}

		return user;
	}

	async createUser(account: NewAccount, role: Role): Promise<User> {
		return this.createLocalAccount(account, role);
	}

	// The email column's UNIQUE is case-sensitive while every lookup ignores case, so
	// Dana@x and dana@x must not both get in: checked here, before the write.
	private async assertEmailFree(email: string, exceptUserId?: number): Promise<void> {
		const holder = await this.userRepo.getUserByEmail(email);
		if (holder && Number(holder.id) !== exceptUserId) throw new Error(EMAIL_TAKEN);
	}

	private async createLocalAccount(account: NewAccount, role: Role): Promise<User> {
		const email = account.email?.trim() || null;
		if (email) await this.assertEmailFree(email);
		const hash = await bcrypt.hash(account.password, BCRYPT_SALT_ROUNDS);
		const result = await this.userRepo.createUser({
			username: usernameFor(account),
			email,
			passwordHash: hash,
			fullName: account.fullName,
			role,
		});
		const user = await this.userRepo.getUserById(result.lastID);
		if (!user) throw new Error('User creation failed');
		this.onUsersChanged?.();
		return user;
	}

	// By username, or by email for older callers.
	async updateUserRole(identifier: string, newRole: Role): Promise<boolean> {
		return this.userRepo.updateUserRole(identifier, newRole);
	}

	// The local account a login names. Anything with "@" is an email; a bare name is a
	// username first and, for installations that still rely on the default login domain,
	// the address it completes to. Either lookup ignores letter case.
	private async findLocalLogin(identifier: string) {
		const typed = identifier.trim();
		if (typed === '') return undefined;
		if (typed.includes('@')) return this.userRepo.findLoginByEmail(typed);
		const byUsername = await this.userRepo.findLoginByUsername(typed);
		if (byUsername) return byUsername;
		const completed = completeLoginIdentifier(typed, this.loginDefaultEmailDomain);
		return completed.includes('@') ? this.userRepo.findLoginByEmail(completed) : undefined;
	}

	// A local account always signs in locally — including the first admin, which is the
	// way in when the directory is down or misconfigured. Anyone else is checked against
	// LDAP when it is enabled; on success their OpsiMate account is created, or brought
	// in step with the directory (name, role), and they are signed in.
	async login(identifier: string, password: string): Promise<User> {
		const existing = await this.findLocalLogin(identifier);

		if (existing && existing.user.authSource !== 'ldap') {
			if (!(await bcrypt.compare(password, existing.passwordHash))) throw new Error(INVALID_LOGIN);
			return existing.user;
		}
		if (!this.ldap) {
			// A directory account while LDAP is switched off: nothing can vouch for it.
			throw new Error(INVALID_LOGIN);
		}
		// The directory is asked by email (a username completes to one with the default
		// login domain); a bare name with no domain is not a directory login yet.
		const email = completeLoginIdentifier(identifier, this.loginDefaultEmailDomain);
		const normalizedEmail = email.trim().toLowerCase();
		if (!normalizedEmail.includes('@')) throw new Error(INVALID_LOGIN);

		if (this.ldapFailures?.isThrottled(normalizedEmail)) throw new TooManyLoginAttemptsError();
		const identity = await this.ldap.authenticate(normalizedEmail, password);
		if (!identity) {
			if (this.ldapFailures?.recordFailure(normalizedEmail) === this.ldapMaxFailures) {
				logger.warn(`LDAP login for ${normalizedEmail} throttled after ${this.ldapMaxFailures} failures`);
			}
			throw new Error(INVALID_LOGIN);
		}
		this.ldapFailures?.reset(normalizedEmail);
		if (!identity.role) {
			logger.warn(`LDAP login refused for ${identity.email}: in none of the mapped groups`);
			throw new Error(NOT_ALLOWED_LOGIN);
		}
		return this.provisionDirectoryUser(identity.email, identity.fullName, identity.role, identity.dn);
	}

	// The account for an email, for something that is not a login — a webhook naming an
	// alert's owner. A local or already-provisioned account is found as is (any letter
	// case). Otherwise, with LDAP on, the directory is asked, and a user in a mapped group
	// is provisioned now exactly as their first login would (they log in later as usual).
	// null when nobody matches, or the directory is down (an alert must still be ingested).
	async findOrProvisionUserByEmail(email: string): Promise<User | null> {
		const normalized = email.trim().toLowerCase();
		if (!normalized) return null;
		const link = await this.userRepo.findDirectoryLink(normalized);
		if (link) return this.userRepo.getUserById(link.id);
		if (!this.ldap) return null;
		try {
			const identity = await this.ldap.lookup(normalized);
			if (!identity) return null;
			if (!identity.role) {
				logger.warn(`Directory user ${normalized} is in none of the mapped groups; not provisioned`);
				return null;
			}
			return await this.provisionDirectoryUser(identity.email, identity.fullName, identity.role, identity.dn);
		} catch (error) {
			logger.warn(`Could not resolve ${normalized} in the directory: ${(error as Error).message}`);
			return null;
		}
	}

	private async provisionDirectoryUser(email: string, fullName: string, role: Role, dn: string): Promise<User> {
		const link = await this.userRepo.findDirectoryLink(email);
		if (link && link.authSource !== 'ldap') {
			// A local account has this email (in any letter case): never take a local
			// account over from the directory.
			throw new Error(INVALID_LOGIN);
		}
		if (link) {
			if (link.ldapDn && link.ldapDn.toLowerCase() !== dn.toLowerCase()) {
				// Another directory entry now answers for this email (address reused, or
				// the entry was moved/renamed): don't hand it the old person's account.
				logger.warn(
					`LDAP login for ${email} refused: the account belongs to ${link.ldapDn}, not ${dn}. ` +
						'Delete the OpsiMate user to let the new entry sign in.'
				);
				throw new Error(INVALID_LOGIN);
			}
			if (!link.ldapDn) await this.userRepo.setLdapDn(link.id, dn);
			return this.syncDirectoryAccount(link.id, fullName, role);
		}
		try {
			// No usable password hash: this account can only ever sign in through LDAP.
			const result = await this.userRepo.createUser({
				username: usernameFromEmail(email),
				email,
				passwordHash: DIRECTORY_PASSWORD_HASH,
				fullName,
				role,
				authSource: 'ldap',
				ldapDn: dn,
			});
			const created = await this.userRepo.getUserById(result.lastID);
			if (!created) throw new Error('User creation failed');
			logger.info(`Provisioned ${email} from LDAP as ${role}`);
			this.onUsersChanged?.();
			return created;
		} catch (error) {
			// Two first logins at once: the other one created it; use that account.
			const raced = await this.userRepo.findDirectoryLink(email);
			if (raced?.authSource === 'ldap' && raced.ldapDn?.toLowerCase() === dn.toLowerCase()) {
				return this.syncDirectoryAccount(raced.id, fullName, role);
			}
			throw error;
		}
	}

	private async syncDirectoryAccount(userId: number, fullName: string, role: Role): Promise<User> {
		const current = await this.userRepo.getUserById(userId);
		if (!current) throw new Error('User not found');
		if (current.fullName === fullName && current.role === role) return current;
		await this.userRepo.syncDirectoryUser(userId, fullName, role);
		this.onUsersChanged?.();
		const synced = await this.userRepo.getUserById(userId);
		if (!synced) throw new Error('User not found');
		return synced;
	}

	private async assertLocalAccount(userId: number, action: string): Promise<void> {
		const user = await this.userRepo.getUserById(userId);
		if (user?.authSource === 'ldap') throw new DirectoryManagedError(action);
	}

	async resetUserPassword(userId: number, newPassword: string): Promise<void> {
		await this.assertLocalAccount(userId, 'Its password');
		const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
		await this.userRepo.updateUserPassword(userId, hashedPassword);
	}

	async updateUser(userId: number, updates: UserUpdates): Promise<User> {
		// The username and email are what link a directory account to its LDAP entry. The
		// edit form always sends them, so only an actual change is refused.
		if (updates.email !== undefined || updates.username !== undefined) {
			const current = await this.userRepo.getUserById(userId);
			if (current?.authSource === 'ldap') {
				const emailChanges =
					updates.email !== undefined &&
					(updates.email?.trim().toLowerCase() ?? null) !== (current.email?.toLowerCase() ?? null);
				if (emailChanges) throw new DirectoryManagedError('Its email');
				const usernameChanges =
					updates.username !== undefined && updates.username.trim().toLowerCase() !== current.username;
				if (usernameChanges) throw new DirectoryManagedError('Its username');
			}
		}
		if (updates.email) await this.assertEmailFree(updates.email, userId);
		await this.userRepo.updateUser(userId, updates);
		const updatedUser = await this.userRepo.getUserById(userId);
		if (!updatedUser) {
			throw new Error('User not found');
		}
		this.onUsersChanged?.();
		return updatedUser;
	}

	async getAllUsers(): Promise<User[]> {
		return await this.userRepo.getAllUsers();
	}

	async deleteUser(id: number): Promise<void> {
		await this.userRepo.deleteUser(id);
		this.onUsersChanged?.();
	}

	async getUserById(id: number): Promise<User | null> {
		return this.userRepo.getUserById(id);
	}

	/**
	 * Returns true if any users exist in the database, otherwise false.
	 */
	async usersExist(): Promise<boolean> {
		const count = await this.userRepo.countUsers();
		return count > 0;
	}

	async updateProfile(
		id: number,
		fullName: string,
		newPassword?: string,
		phoneNumber?: string | null
	): Promise<User> {
		let passwordHash: string | undefined;
		if (newPassword) {
			await this.assertLocalAccount(id, 'Your password');
			passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
		}

		await this.userRepo.updateUserProfile(id, fullName, passwordHash, phoneNumber);
		const updatedUser = await this.userRepo.getUserById(id);
		if (!updatedUser) {
			throw new Error('User not found');
		}
		this.onUsersChanged?.();
		return updatedUser;
	}

	async forgotPassword(email: string): Promise<void> {
		const user = await this.userRepo.getUserByEmail(email);
		if (user?.authSource === 'ldap') {
			// Same silent answer as for an unknown email: no reset link for a password
			// OpsiMate does not hold.
			logger.info('Password reset requested for a directory (LDAP) account; ignored');
			return;
		}
		if (!user) {
			logger.info('Password reset requested for non-existent email');
			return;
		}
		// getUserByEmail found it by that address, so it has one; the guard is for the type.
		const to = user.email;
		if (!to) return;

		let resetPasswordConfig: ReturnType<typeof generatePasswordResetInfo> | undefined;
		try {
			resetPasswordConfig = generatePasswordResetInfo();
			// User.id is a string at the API boundary; users, password_resets and audit_logs
			// all key their user id as an INTEGER column.
			await this.passwordResetsRepo.createPasswordResetToken({
				userId: Number(user.id),
				tokenHash: resetPasswordConfig.tokenHash,
				expiresAt: resetPasswordConfig.expiresAt,
			});

			await this.mailClient.sendMail({
				to,
				subject: 'Password Reset Request',
				mailType: MailType.PASSWORD_RESET,
				token: resetPasswordConfig.encryptedToken,
				userName: user.fullName,
			});
		} catch (error) {
			logger.error('Failed to send password reset email', error);
			if (resetPasswordConfig) {
				await this.passwordResetsRepo.deletePasswordResetByUserIdAndTokenHash(
					Number(user.id),
					resetPasswordConfig.tokenHash
				);
			}
			throw new Error('Failed to send password reset email. Please try again later.', { cause: error });
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

			const currentHash = await this.userRepo.getPasswordHash(Number(user.id));
			if (!currentHash) {
				throw new Error('User login info not found');
			}

			const isSamePassword = await bcrypt.compare(newPassword, currentHash);

			if (isSamePassword) {
				throw new Error('You cannot reuse an old password');
			}

			await this.resetUserPassword(Number(user.id), newPassword);
			await this.passwordResetsRepo.deletePasswordResetsByUserId(Number(user.id));

			await this.auditBL.logAction({
				actionType: AuditActionType.UPDATE,
				resourceType: AuditResourceType.USER,
				resourceId: String(user.id),
				userId: Number(user.id),
				userName: user.fullName,
				resourceName: user.username,
				details: 'User reset their password via email link',
			});
		} catch (error) {
			logger.error(`Error resetting password for user`, error);
			throw error;
		}
	}
}
