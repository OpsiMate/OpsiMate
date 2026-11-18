import { Logger, User } from '@OpsiMate/shared';
import { completeLoginIdentifier, UserBL } from '../users/user.bl';

const logger = new Logger('bl/alerts/webhookOwnerResolver');

// Five minutes: the same alert re-fires every minute from most monitors, and neither the
// users table nor the directory should be asked again each time; a person added in the
// meantime is picked up within the window.
const CACHE_TTL_MS = 5 * 60 * 1000;

// Turns the `owner` a webhook sends — a username or an email — into an OpsiMate user,
// provisioning a directory user who has never logged in (see UserBL.findOrProvisionUser).
// A bare name that matches nobody is also tried as the address the (deprecated) default
// login domain completes it to. Results are cached, misses included.
export class WebhookOwnerResolver {
	private readonly cache = new Map<string, { user: User | null; expires: number }>();

	constructor(
		private readonly userBL: UserBL,
		private readonly defaultEmailDomain: () => string | null
	) {}

	async resolve(identifier: string): Promise<User | null> {
		const typed = identifier.trim().toLowerCase();
		if (!typed) return null;
		const cached = this.cache.get(typed);
		if (cached && cached.expires > Date.now()) return cached.user;
		let user = await this.userBL.findOrProvisionUser(typed);
		if (!user) {
			const completed = completeLoginIdentifier(typed, this.defaultEmailDomain()).toLowerCase();
			if (completed !== typed) user = await this.userBL.findOrProvisionUser(completed);
		}
		if (!user) logger.debug(`Webhook owner ${typed} matches no user`);
		this.cache.set(typed, { user, expires: Date.now() + CACHE_TTL_MS });
		return user;
	}

	// Users changed (created, deleted): forget what we knew.
	clear(): void {
		this.cache.clear();
	}
}
