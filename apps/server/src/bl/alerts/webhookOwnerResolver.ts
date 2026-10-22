import { Logger, User } from '@OpsiMate/shared';
import { completeLoginIdentifier, UserBL } from '../users/user.bl';

const logger = new Logger('bl/alerts/webhookOwnerResolver');

// Five minutes: the same alert re-fires every minute from most monitors, and neither the
// users table nor the directory should be asked again each time; a person added in the
// meantime is picked up within the window.
const CACHE_TTL_MS = 5 * 60 * 1000;

// Turns the `owner` a webhook sends — an email, or a bare name completed with the
// installation's default login domain — into an OpsiMate user, provisioning a directory
// user who has never logged in (see UserBL.findOrProvisionUserByEmail). Results are
// cached, misses included.
export class WebhookOwnerResolver {
	private readonly cache = new Map<string, { user: User | null; expires: number }>();

	constructor(
		private readonly userBL: UserBL,
		private readonly defaultEmailDomain: () => string | null
	) {}

	async resolve(identifier: string): Promise<User | null> {
		const email = completeLoginIdentifier(identifier, this.defaultEmailDomain()).toLowerCase();
		// Only an address can name an account; a bare name with no default domain cannot.
		if (!email.includes('@')) return null;
		const cached = this.cache.get(email);
		if (cached && cached.expires > Date.now()) return cached.user;
		const user = await this.userBL.findOrProvisionUserByEmail(email);
		if (!user) logger.debug(`Webhook owner ${email} matches no user`);
		this.cache.set(email, { user, expires: Date.now() + CACHE_TTL_MS });
		return user;
	}

	// Users changed (created, deleted): forget what we knew.
	clear(): void {
		this.cache.clear();
	}
}
