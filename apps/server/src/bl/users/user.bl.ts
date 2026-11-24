import { DirectoryAccountLink, LoginRecord, UserRepository, UserUpdates } from '../../dal/userRepository';
import bcrypt from 'bcrypt';
import { AuditActionType, AuditResourceType, Logger, Role, User, usernameFromEmail } from '@OpsiMate/shared';
import { MailClient, MailType } from '../../dal/external-client/mail-client';
import { PasswordResetsRepository } from '../../dal/passwordResetsRepository';
import { AuditBL } from '../audit/audit.bl';
import { decryptPassword, generatePasswordResetInfo, hashString } from '../../utils/encryption';
import {
	LdapAuthenticator,
	LdapBindGuard,
	LdapIdentity,
	LdapThrottledError,
	LdapUnavailableError,
} from './ldapAuthenticator';
import { LoginThrottle } from './loginThrottle';
import { MS_PER_MINUTE } from '../../utils/time';

// Work factor used for every password hash created by this module.
const BCRYPT_SALT_ROUNDS = 10;

export const INVALID_LOGIN = 'Invalid username or password';
export const USERNAME_TAKEN = 'Username already taken';
export const EMAIL_TAKEN = 'Email already registered';
// An old database can hold Dana@x and dana@x as two accounts; a request naming the
// address in a third spelling cannot tell which it means.
export const AMBIGUOUS_EMAIL = 'That email belongs to more than one account; use the username';

// How a login request named the account (see UserBL.login).
export interface LoginOptions {
	// The request used the old `email` field rather than `identifier`.
	legacyEmailField?: boolean;
}

// A new local account as the API describes it: a username, or only an email (older
// clients, scripts) from which the username is taken.
export interface NewAccount {
	username?: string;
	email?: string | null;
	fullName: string;
	password: string;
}

// The login name a new account asked for: the one given, else the email's local part.
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

	// The directory itself changed (switched on or off, pointed elsewhere): who can be
	// found changed, though no user row did. Cached misses (webhook owners) are stale.
	private onDirectoryChanged: (() => void) | null = null;

	setOnDirectoryChanged(callback: () => void): void {
		this.onDirectoryChanged = callback;
	}

	// Directory login (see LdapAuthenticator); null when LDAP is not configured.
	private ldap: LdapAuthenticator | null = null;
	// Failed directory logins per email (lower-cased), in a fixed window.
	// null = no limit (login_max_failures: 0).
	private ldapFailures: LoginThrottle | null = null;
	private ldapMaxFailures = DEFAULT_LDAP_MAX_FAILURES;

	setLdapAuthenticator(ldap: LdapAuthenticator | null, maxFailures = DEFAULT_LDAP_MAX_FAILURES): void {
		this.ldap = ldap;
		this.onDirectoryChanged?.();
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

	// A username nobody holds: `base` itself, else base2, base3, ... For names OpsiMate
	// derives (from an email, from a directory entry) — a name the caller asked for by
	// itself is never changed behind their back; it is refused when taken.
	private allocateUsername(base: string): Promise<string> {
		return this.userRepo.nextFreeUsername(base);
	}

	// The account an email names, for an action on it. Exact spelling wins; otherwise the
	// address must match a single account ignoring case — several (an old database's
	// spellings) is a question the caller has to settle by username.
	private async accountByEmail(email: string): Promise<User | null> {
		const matches = await this.userRepo.findUsersByEmail(email);
		const exact = matches.find((user) => user.email === email.trim());
		if (exact) return exact;
		if (matches.length > 1) throw new Error(AMBIGUOUS_EMAIL);
		return matches[0] ?? null;
	}

	private async createLocalAccount(account: NewAccount, role: Role): Promise<User> {
		const email = account.email?.trim() || null;
		if (email) await this.assertEmailFree(email);
		const requested = usernameFor(account);
		const username = account.username ? requested : await this.allocateUsername(requested);
		const hash = await bcrypt.hash(account.password, BCRYPT_SALT_ROUNDS);
		const result = await this.userRepo.createUser({
			username,
			email,
			passwordHash: hash,
			fullName: account.fullName,
			role,
		});
		const user = await this.userRepo.getUserById(result.lastID);
		if (!user) throw new Error('User creation failed');
		this.onUsersChanged?.();
		this.sendWelcomeEmail(user);
		return user;
	}

	// Shared by self-registration and admin-created accounts, when the account has an
	// address. Delivery is fire-and-forget so an SMTP failure cannot roll back a user that
	// was already saved.
	private sendWelcomeEmail(user: User): void {
		if (!user.email) return;
		void this.mailClient
			.sendMail({
				to: user.email,
				mailType: MailType.WELCOME,
				userName: user.fullName,
			})
			.catch((error) => logger.error('Failed to send welcome email', error));
	}

	// By username, or by email for older callers. One account, resolved first: an address
	// that an old database holds in several spellings must not change several roles.
	async updateUserRole(identifier: string, newRole: Role): Promise<boolean> {
		const typed = identifier.trim();
		const user = typed.includes('@')
			? await this.accountByEmail(typed)
			: await this.userRepo.getUserByUsername(typed);
		if (!user) return false;
		return this.userRepo.updateUserRoleById(Number(user.id), newRole);
	}

	// The local accounts a login may name. Through the login field (`identifier`) a bare
	// name is a username, and only that; through the legacy `email` field a bare name has
	// always meant <name>@<default domain>, so that account comes first and the account
	// whose username it is second — an older account whose migrated username happens to
	// be that name must not capture a login that always meant the address. Anything with
	// "@" is an email only. Lookups ignore letter case.
	private async localLoginCandidates(identifier: string, legacyEmailField: boolean): Promise<LoginRecord[]> {
		const typed = identifier.trim();
		if (typed === '') return [];
		if (typed.includes('@')) {
			const byEmail = await this.userRepo.findLoginByEmail(typed);
			return byEmail ? [byEmail] : [];
		}
		const byUsername = await this.userRepo.findLoginByUsername(typed);
		if (!legacyEmailField) return byUsername ? [byUsername] : [];
		const completed = completeLoginIdentifier(typed, this.loginDefaultEmailDomain);
		const byEmail = completed.includes('@') ? await this.userRepo.findLoginByEmail(completed) : undefined;
		const candidates: LoginRecord[] = [];
		if (byEmail) candidates.push(byEmail);
		if (byUsername && byUsername.user.id !== byEmail?.user.id) candidates.push(byUsername);
		return candidates;
	}

	// A local account always signs in locally — including the first admin, which is the
	// way in when the directory is down or misconfigured. Anyone else is checked against
	// LDAP when it is enabled; on success their OpsiMate account is created, or brought
	// in step with the directory (name, role), and they are signed in. `options.legacyEmailField`
	// says the request used the old `email` field (see localLoginCandidates).
	async login(identifier: string, password: string, options: LoginOptions = {}): Promise<User> {
		const legacyEmailField = options.legacyEmailField === true;
		const candidates = await this.localLoginCandidates(identifier, legacyEmailField);
		for (const local of candidates) {
			if (local.user.authSource === 'ldap') continue;
			if (await bcrypt.compare(password, local.passwordHash)) return local.user;
		}
		const directoryAccount = candidates.find((candidate) => candidate.user.authSource === 'ldap');
		const typed = identifier.trim().toLowerCase();
		// An explicit username (the login field, no "@") names exactly one account: a local
		// one has just failed its password check and that is the end of it; an unknown one
		// is asked of the directory as a username. Through the legacy email field a bare
		// name still completes with the default login domain.
		const explicitUsername = !legacyEmailField && !typed.includes('@');
		if (explicitUsername && candidates.length > 0 && !directoryAccount) throw new Error(INVALID_LOGIN);
		const completed = completeLoginIdentifier(typed, this.loginDefaultEmailDomain).toLowerCase();
		// The spellings the directory is searched for, one bind at the end. Through the
		// legacy email field a bare name has always meant <name>@<domain>, so that address
		// comes first and the name itself second; through the login field the name comes
		// first and is never completed — an explicit username must not end up signed in as
		// whoever holds <name>@<domain>. A known directory account's own address is tried
		// too.
		const knownAddress = directoryAccount?.user.email?.toLowerCase();
		const ordered = explicitUsername ? [typed, knownAddress] : [completed, typed, knownAddress];
		const spellings = [...new Set(ordered.filter((spelling): spelling is string => !!spelling))];
		// A local account owns one of these addresses itself, in any spelling: no directory
		// entry may stand in for it. (A local account that merely has the typed name as its
		// username is unrelated to the address and blocks nothing; a directory entry carrying
		// that username is refused at provisioning.)
		for (const address of spellings.filter((spelling) => spelling.includes('@'))) {
			const owners = await this.userRepo.findUsersByEmail(address);
			if (owners.some((owner) => owner.authSource !== 'ldap')) throw new Error(INVALID_LOGIN);
		}
		if (!this.ldap) {
			// A directory account while LDAP is switched off: nothing can vouch for it.
			throw new Error(INVALID_LOGIN);
		}

		// Two throttles. Before the directory is searched, the login's preferred spelling
		// bounds the searches: through the login field the named account's address when
		// known (an explicit username names one account), through the legacy email field
		// the completed address — a username holder is only a fallback there and its own
		// budget is not this login's. Once the entry is found, the account itself — its DN —
		// carries the budget, so a username and an email for the same account share one
		// count whether or not the account has an OpsiMate row yet.
		const firstAddress = spellings.find((spelling) => spelling.includes('@'));
		const throttleKey = explicitUsername ? (knownAddress ?? typed) : (firstAddress ?? typed);
		if (this.ldapFailures?.isThrottled(throttleKey)) throw new TooManyLoginAttemptsError();
		// The attempt is counted BEFORE the bind, as a reservation: concurrent requests for
		// one account cannot all pass the check while the bind is in flight and then each
		// send a guess the directory's own lockout counts. A success gives them all back.
		const guard: LdapBindGuard = {
			allow: (dn) => {
				const key = dn.toLowerCase();
				if (this.ldapFailures?.isThrottled(key)) {
					logger.warn(`LDAP login for ${dn} refused: ${this.ldapMaxFailures} failures within the window`);
					return false;
				}
				this.ldapFailures?.recordFailure(key);
				return true;
			},
			failed: () => undefined,
			abandoned: (dn) => this.ldapFailures?.forgive(dn.toLowerCase()),
			succeeded: (dn) => this.ldapFailures?.reset(dn.toLowerCase()),
		};
		let identity: LdapIdentity | null;
		try {
			identity = await this.ldap.authenticate(spellings[0], password, spellings.slice(1), guard);
		} catch (error) {
			if (error instanceof LdapThrottledError) throw new TooManyLoginAttemptsError();
			throw error;
		}
		if (!identity) {
			this.ldapFailures?.recordFailure(throttleKey);
			throw new Error(INVALID_LOGIN);
		}
		this.ldapFailures?.reset(throttleKey);
		if (!identity.role) {
			logger.warn(`LDAP login refused for ${identity.username}: in none of the mapped groups`);
			throw new Error(NOT_ALLOWED_LOGIN);
		}
		// A login that named a known directory account by its username stays that account:
		// the stored address, tried as an alternative, must not have reached another
		// directory object. The same object at a new DN (moved, renamed) is still it, and
		// provisioning records where it lives now. (Through the legacy email field the
		// completed address comes first and may rightly be someone else's; the account it
		// reaches is checked at provisioning.)
		if (explicitUsername && directoryAccount) {
			const link = await this.userRepo.findDirectoryLinkByUsername(directoryAccount.user.username);
			if (link && !UserBL.sameDirectoryObject(link, identity)) {
				logger.warn(
					`LDAP login for ${typed} refused: ${identity.dn} is not the account's directory object (${link.ldapDn})`
				);
				throw new Error(INVALID_LOGIN);
			}
		}
		return this.provisionDirectoryUser(identity);
	}

	// The account for a username or email, for something that is not a login — a webhook
	// naming an alert's owner. Spelling by spelling (the identifier, then each
	// alternative): an existing account first, then — with LDAP on — the directory, so an
	// exact username is settled before a completed address can point elsewhere. A
	// directory user in a mapped group is provisioned now exactly as their first login
	// would (they log in later as usual). null when nobody matches; a directory that
	// cannot answer is thrown as LdapUnavailableError, for the caller to not remember.
	async findOrProvisionUser(identifier: string, alternatives: string[] = []): Promise<User | null> {
		const normalized = identifier.trim().toLowerCase();
		if (!normalized) return null;
		const spellings = [normalized, ...alternatives.map((alt) => alt.trim().toLowerCase())];
		// Every spelling is looked up locally before the directory is asked at all: an
		// account that exists is the answer whether or not the directory can be reached.
		for (const spelling of spellings) {
			const link = spelling.includes('@')
				? await this.userRepo.findDirectoryLink(spelling)
				: await this.userRepo.findDirectoryLinkByUsername(spelling);
			if (link) return this.userRepo.getUserById(link.id);
		}
		if (!this.ldap) return null;
		// One connection for every spelling: the first entry found is the answer.
		let identity: LdapIdentity | null;
		try {
			identity = await this.ldap.lookup(spellings[0], spellings.slice(1));
		} catch (error) {
			if (error instanceof LdapUnavailableError) throw error;
			logger.warn(`Could not resolve ${normalized} in the directory: ${(error as Error).message}`);
			return null;
		}
		if (!identity) return null;
		if (!identity.role) {
			logger.warn(`Directory user ${identity.username} is in none of the mapped groups; not provisioned`);
			return null;
		}
		try {
			return await this.provisionDirectoryUser(identity);
		} catch (error) {
			// A refusal is an answer (a local account holds the identity, another entry
			// owns the account): nobody. Anything else — the database, a race — is not,
			// and is thrown so the caller does not remember it.
			const message = error instanceof Error ? error.message : '';
			if (message === INVALID_LOGIN || message === NOT_ALLOWED_LOGIN) {
				logger.warn(`Directory user ${identity.username} cannot be provisioned: ${message}`);
				return null;
			}
			throw error;
		}
	}

	// The OpsiMate account an identity already has. The directory object itself first (its
	// stable id) — an entry whose username and address both changed still has its account;
	// its DN next, but only while the account has no object id recorded yet (a DN can be
	// reused by a new entry, an object id cannot); then the username; then the email. A
	// local account holding the username does not hide the entry's own account reached
	// through its email.
	private async findDirectoryLinkFor(identity: LdapIdentity) {
		if (identity.objectId) {
			const byObject = await this.userRepo.findDirectoryLinkByObjectId(identity.objectId);
			if (byObject) return byObject;
		}
		// Rows at this DN: one linked before object ids were recorded is this object (it is
		// how such an account gets its id). A row with another object id is another object
		// that lived here, and must not hide the legacy one behind it.
		const atDn = await this.userRepo.findDirectoryLinksByDn(identity.dn);
		const byDn = atDn.find((row) => !row.ldapObjectId) ?? (identity.objectId ? undefined : atDn[0]);
		if (byDn) return byDn;
		const byUsername = await this.userRepo.findDirectoryLinkByUsername(identity.username);
		if (byUsername?.authSource === 'ldap') return byUsername;
		const byEmail = identity.email ? await this.userRepo.findDirectoryLink(identity.email) : null;
		if (byEmail?.authSource === 'ldap' && byEmail.ldapDn?.toLowerCase() === identity.dn.toLowerCase())
			return byEmail;
		return byUsername ?? byEmail;
	}

	// The same directory object as the account's? Same object id when both are known;
	// otherwise the same DN (an account linked before object ids were recorded).
	private static sameDirectoryObject(link: DirectoryAccountLink, identity: LdapIdentity): boolean {
		if (link.ldapObjectId && identity.objectId) return link.ldapObjectId === identity.objectId;
		return !link.ldapDn || link.ldapDn.toLowerCase() === identity.dn.toLowerCase();
	}

	private async provisionDirectoryUser(identity: LdapIdentity): Promise<User> {
		const { username, email, fullName, role, dn } = identity;
		if (!role) throw new Error(NOT_ALLOWED_LOGIN);
		const link = await this.findDirectoryLinkFor(identity);
		if (link && link.authSource !== 'ldap') {
			// A local account has this username or email (in any letter case): never take
			// a local account over from the directory.
			logger.warn(`LDAP login for ${username} refused: a local account has that username or email`);
			throw new Error(INVALID_LOGIN);
		}
		if (link) {
			if (!UserBL.sameDirectoryObject(link, identity)) {
				// Another directory object now answers for this identity (name or address
				// reused, or a new entry at an old DN): don't hand it the old person's account.
				logger.warn(
					`LDAP login for ${username} refused: the account belongs to ${link.ldapDn ?? 'another entry'}, not ${dn}. ` +
						'Delete the OpsiMate user to let the new entry sign in.'
				);
				throw new Error(INVALID_LOGIN);
			}
			// Record where the object lives now and, once known, which object it is.
			if (link.ldapDn?.toLowerCase() !== dn.toLowerCase() || (!link.ldapObjectId && identity.objectId)) {
				await this.userRepo.setDirectoryLink(link.id, dn, identity.objectId);
			}
			return this.syncDirectoryAccount(link.id, identity);
		}
		try {
			// No usable password hash: this account can only ever sign in through LDAP. The
			// username is the directory's; a local account holding it was refused above.
			const result = await this.userRepo.createUser({
				username,
				email,
				passwordHash: DIRECTORY_PASSWORD_HASH,
				fullName,
				role,
				authSource: 'ldap',
				ldapDn: dn,
				ldapObjectId: identity.objectId,
			});
			const created = await this.userRepo.getUserById(result.lastID);
			if (!created) throw new Error('User creation failed');
			logger.info(`Provisioned ${username} from LDAP as ${role}`);
			this.onUsersChanged?.();
			return created;
		} catch (error) {
			// Two first logins at once: the other one created it; use that account.
			const raced = await this.findDirectoryLinkFor(identity);
			if (raced?.authSource === 'ldap' && UserBL.sameDirectoryObject(raced, identity)) {
				return this.syncDirectoryAccount(raced.id, identity);
			}
			throw error;
		}
	}

	// Name, role, email and username follow the directory on every login — an account
	// provisioned before usernames carries its email's local part until its first login
	// brings the directory's name. A value the directory now gives can collide with
	// another account's: then it stays as it was.
	private async syncDirectoryAccount(userId: number, identity: LdapIdentity): Promise<User> {
		const current = await this.userRepo.getUserById(userId);
		if (!current) throw new Error('User not found');
		const role = identity.role ?? current.role;
		// The directory's address. An entry that lists none keeps the stored one (undefined =
		// not written): "no value" is also what a misnamed attribute or a service account
		// that cannot read mail looks like, and that must not strip every directory user of
		// their address. An address someone else holds is not taken either.
		let email: string | null | undefined = identity.email ?? undefined;
		if (email && email.toLowerCase() === current.email?.toLowerCase()) email = undefined;
		if (email) {
			const holder = await this.userRepo.getUserByEmail(email);
			if (holder && holder.id !== current.id) email = undefined;
		}
		// The username likewise: written only when the directory renamed the account and
		// nobody else holds the new name; otherwise the column is left alone.
		let username: string | undefined;
		if (identity.username !== current.username) {
			const holder = await this.userRepo.getUserByUsername(identity.username);
			if (!holder || holder.id === current.id) username = identity.username;
		}
		if (
			current.fullName === identity.fullName &&
			current.role === role &&
			email === undefined &&
			username === undefined
		) {
			return current;
		}
		await this.userRepo.syncDirectoryUser(userId, identity.fullName, role, email, username);
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
		// An address an old database holds in several spellings, none of them the typed one,
		// gets no link — the same silence as an unknown address.
		let user: User | null;
		try {
			user = await this.accountByEmail(email);
		} catch (error) {
			if (!(error instanceof Error) || error.message !== AMBIGUOUS_EMAIL) throw error;
			logger.info('Password reset requested for an email that matches several accounts; ignored');
			return;
		}
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
		// Found by that address, so it has one; the guard is for the type.
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
