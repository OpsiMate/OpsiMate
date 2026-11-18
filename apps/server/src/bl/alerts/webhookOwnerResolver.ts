import { Logger, User } from '@OpsiMate/shared';
import { LdapUnavailableError } from '../users/ldapAuthenticator';
import { completeLoginIdentifier, UserBL } from '../users/user.bl';

const logger = new Logger('bl/alerts/webhookOwnerResolver');

// Five minutes: the same alert re-fires every minute from most monitors, and neither the
// users table nor the directory should be asked again each time; a person added in the
// meantime is picked up within the window.
const CACHE_TTL_MS = 5 * 60 * 1000;
// Every distinct owner an integration ever sent would otherwise stay in memory; a team
// alias or a typo per alert adds up on a long-running instance.
const CACHE_MAX_ENTRIES = 1000;

interface CachedOwner {
	user: User | null;
	expires: number;
}

export interface WebhookOwnerLookup {
	user: User | null;
	// Set when there is no answer rather than a "nobody": the directory could not be
	// asked, or provisioning failed on the way. Not remembered; the next webhook retries.
	failure?: string;
}

// Turns the `owner` a webhook sends — a username or an email — into an OpsiMate user,
// provisioning a directory user who has never logged in (see UserBL.findOrProvisionUser).
// A bare name that matches nobody is also tried as the address the (deprecated) default
// login domain completes it to. Results are cached, misses included — but not a
// directory that could not answer: the next webhook asks again.
export class WebhookOwnerResolver {
	private readonly cache = new Map<string, CachedOwner>();
	// Bumped by clear(): a lookup that started before the users changed must not write
	// its (possibly stale) answer into the cleared cache.
	private generation = 0;

	constructor(
		private readonly userBL: UserBL,
		private readonly defaultEmailDomain: () => string | null
	) {}

	async resolve(identifier: string): Promise<User | null> {
		return (await this.lookup(identifier)).user;
	}

	// The user, or why there is none: a miss (`user: null`), or no answer (`failure`).
	async lookup(identifier: string): Promise<WebhookOwnerLookup> {
		const typed = identifier.trim().toLowerCase();
		if (!typed) return { user: null };
		const cached = this.cache.get(typed);
		if (cached && cached.expires > Date.now()) return { user: cached.user };
		const generation = this.generation;
		// The completed address rides along as an alternative, tried after the name itself.
		const completed = completeLoginIdentifier(typed, this.defaultEmailDomain()).toLowerCase();
		let user: User | null;
		try {
			user = await this.userBL.findOrProvisionUser(typed, completed !== typed ? [completed] : []);
		} catch (error) {
			// Not an answer — the directory could not be asked, or provisioning failed on
			// the way (the database, a race): nothing is remembered, so the next webhook
			// retries. The alert itself is ingested regardless.
			const reason =
				error instanceof LdapUnavailableError ? 'the directory could not be asked' : 'provisioning failed';
			const detail = error instanceof Error ? error.message : String(error);
			logger.warn(`Webhook owner ${typed}: ${reason} (${detail})`);
			return { user: null, failure: `${reason}: ${detail}` };
		}
		if (!user) logger.debug(`Webhook owner ${typed} matches no user`);
		if (generation === this.generation) this.remember(typed, user);
		return { user };
	}

	private remember(key: string, user: User | null): void {
		const now = Date.now();
		if (this.cache.size >= CACHE_MAX_ENTRIES) {
			for (const [name, entry] of this.cache) if (entry.expires <= now) this.cache.delete(name);
			// Still full of live entries: the oldest insertion goes (Map iterates in order).
			if (this.cache.size >= CACHE_MAX_ENTRIES) {
				const oldest = this.cache.keys().next().value;
				if (oldest !== undefined) this.cache.delete(oldest);
			}
		}
		this.cache.set(key, { user, expires: now + CACHE_TTL_MS });
	}

	// Users changed (created, deleted): forget what we knew, and what is still being looked up.
	clear(): void {
		this.generation++;
		this.cache.clear();
	}
}
