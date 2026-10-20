import { NextFunction, Response } from 'express';
import { LoginThrottle } from '../bl/users/loginThrottle';
import { AuthenticatedRequest } from './auth';

export interface RateLimitOptions {
	// Requests allowed per caller per window. 0 = no limit.
	maxPerWindow: number;
	windowMs: number;
	now?: () => number;
}

// Who a request counts against: the signed-in user, else the instance API token (one key —
// there is only one token), else the client address. Meant to run AFTER authentication,
// so a caller without credentials is stopped by the 401 and cannot fill someone's bucket.
export const callerKey = (req: AuthenticatedRequest): string => {
	if (req.user) return `user:${req.user.id}`;
	const apiToken = req.headers['x-api-token'] ?? req.query.api_token;
	if (typeof apiToken === 'string' && apiToken.length > 0) return 'api-token';
	return `ip:${req.ip ?? 'unknown'}`;
};

// A fixed-window request limit per caller, on the login throttle's counter (its "failure"
// is a request here): fixed memory, keys hashed with a per-process secret, nothing to
// evict. Over the limit answers 429 with Retry-After; the request is not counted.
export const createRateLimit = (options: RateLimitOptions) => {
	if (options.maxPerWindow <= 0) {
		return (_req: AuthenticatedRequest, _res: Response, next: NextFunction): void => next();
	}
	const counter = new LoginThrottle({
		maxFailures: options.maxPerWindow,
		windowMs: options.windowMs,
		buckets: 4096,
		now: options.now,
	});
	const windowSeconds = Math.ceil(options.windowMs / 1000);
	return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
		const key = callerKey(req);
		if (counter.isThrottled(key)) {
			res.setHeader('Retry-After', String(windowSeconds));
			res.status(429).json({
				success: false,
				error: `Rate limit: at most ${options.maxPerWindow} requests per ${windowSeconds}s per caller. Try again later.`,
			});
			return;
		}
		counter.recordFailure(key);
		next();
	};
};
