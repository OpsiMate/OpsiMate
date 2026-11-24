import { timingSafeEqual } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role, User } from '@OpsiMate/shared';
import { getSecurityConfig } from '../config/config.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-secret';

export interface AuthenticatedRequest extends Request {
	user?: User;
}

interface AuthenticateOptions {
	// Skip the Viewer edit-method check: for a route whose POSTs never write.
	readOnly: boolean;
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
	return authenticate(req, res, next, { readOnly: false });
}

/**
 * The same credentials and precedence as `authenticateJWT`, but any role may use any
 * method. For routes that only read even though they are called with POST (an RPC-style
 * endpoint such as MCP), where the Viewer edit-method 403 would lock Viewers out of a
 * read. Must never guard a route that writes.
 */
export function authenticateReadOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
	return authenticate(req, res, next, { readOnly: true });
}

function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction, options: AuthenticateOptions) {
	const apiToken = req.headers['x-api-token'] || req.query.api_token;
	const bearerToken = req.headers.authorization || '';

	// If neither token type is provided, reject immediately
	const hasBearer = bearerToken && bearerToken.startsWith('Bearer ');
	const hasApiToken = typeof apiToken === 'string' && apiToken.length > 0;
	if (!hasBearer && !hasApiToken) {
		return res.status(401).json({ success: false, error: 'Missing Authorization header or API token' });
	}

	// Prefer API token if provided
	if (hasApiToken) {
		return authenticateApiToken(apiToken, res, next);
	}

	// The instance API token is also accepted as Bearer credentials. Some senders can
	// only keep a secret in the Authorization header: Grafana stores a webhook's URL and
	// extra headers in plain text but encrypts and masks "Authentication Header
	// Credentials". A signed JWT never equals the configured token, so this cannot
	// shadow a user session; like x-api-token, it carries no user and admin routes
	// still refuse it.
	if (isInstanceApiToken(bearerToken.slice('Bearer '.length))) {
		return next();
	}

	// Otherwise, use JWT
	return authenticateUserJWT(bearerToken, req, res, next, options);
}

// False, never a throw, when no token is configured: a config file may omit
// security.api_token (then API-token auth is simply off), and this runs in front of
// every JWT check.
function isInstanceApiToken(candidate: string): boolean {
	const expected = getSecurityConfig().api_token;
	if (typeof expected !== 'string' || expected.length === 0) {
		return false;
	}
	const a = Buffer.from(candidate.trim());
	const b = Buffer.from(expected);
	return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/**
 * Router-level admin gate. MUST be mounted after `authenticateJWT`, which is what
 * populates `req.user`. API-token callers have no `req.user` and are rejected here —
 * org-wide configuration is a human-admin operation.
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
	if (!req.user || req.user.role !== Role.Admin) {
		return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
	}
	return next();
}

function authenticateApiToken(apiToken: string, res: Response, next: NextFunction) {
	if (apiToken !== getSecurityConfig().api_token) {
		return res.status(401).json({ success: false, error: 'Invalid API token' });
	}

	return next();
}

function authenticateUserJWT(
	bearerToken: string,
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
	options: AuthenticateOptions
) {
	const token = bearerToken.split(' ')[1];

	try {
		const payload = jwt.verify(token, JWT_SECRET) as User;
		req.user = payload;

		// Viewer edit restrictions
		const editMethods = ['PUT', 'PATCH', 'DELETE', 'POST'];
		if (!options.readOnly && editMethods.includes(req.method) && payload.role === Role.Viewer) {
			return res.status(403).json({ success: false, error: 'Forbidden: Viewer users cannot edit data' });
		}

		return next();
	} catch {
		return res.status(401).json({ success: false, error: 'Invalid or expired JWT token' });
	}
}
