import { NextFunction, Request, Response } from 'express';
import { FixedWindowCounter } from './fixedWindowCounter';

export interface RateLimitOptions {
	// Requests allowed per caller per window. 0 = no limit.
	maxPerWindow: number;
	windowMs: number;
	// Who the request counts against; null = not limited (the caller is unknown, which
	// only happens before authentication — those requests are refused anyway).
	keyOf: (req: Request) => string | null;
	now?: () => number;
}

// A fixed-window request limit per caller: an assistant in a loop issues requests far
// faster than a person, and every tool call becomes REST calls to OpsiMate. Over the
// limit answers 429 with Retry-After; the request is not counted.
export const createRateLimit = (options: RateLimitOptions) => {
	if (options.maxPerWindow <= 0) {
		return (_req: Request, _res: Response, next: NextFunction): void => next();
	}
	const counter = new FixedWindowCounter({
		maxHits: options.maxPerWindow,
		windowMs: options.windowMs,
		buckets: 4096,
		now: options.now,
	});
	const windowSeconds = Math.ceil(options.windowMs / 1000);
	return (req: Request, res: Response, next: NextFunction): void => {
		const key = options.keyOf(req);
		if (key === null) return next();
		if (counter.isThrottled(key)) {
			res.setHeader('Retry-After', String(windowSeconds));
			res.status(429).json({
				success: false,
				error: `Rate limit: at most ${options.maxPerWindow} requests per ${windowSeconds}s per caller. Try again later.`,
			});
			return;
		}
		counter.recordHit(key);
		next();
	};
};
