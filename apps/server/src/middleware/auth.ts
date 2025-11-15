import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role, User } from '@OpsiMate/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-secret';

export interface AuthenticatedRequest extends Request {
	user?: User;
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
	const apiToken = req.headers['x-api-token'] || req.query.api_token;
	const authHeader = req.headers.authorization;

	// If neither token type is provided, reject immediately
	const hasBearer = authHeader && authHeader.startsWith('Bearer ');
	const hasApiToken = typeof apiToken === 'string' && apiToken.length > 0;
	if (!hasBearer && !hasApiToken) {
		return res.status(401).json({ success: false, error: 'Missing Authorization header or API token' });
	}

	// Prefer API token if provided
	if (hasApiToken) {
		return authenticateApiToken(req, res, next);
	}

	// Otherwise, use JWT
	return authenticateUserJWT(req, res, next);
}

function authenticateApiToken(req: Request, res: Response, next: NextFunction) {
	const apiToken = req.headers['x-api-token'];

	if (apiToken !== process.env.API_TOKEN) {
		return res.status(401).json({ success: false, error: 'Invalid API token' });
	}

	return next();
}

function authenticateUserJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
	const authHeader = req.headers.authorization!;
	const token = authHeader.split(' ')[1];

	try {
		const payload = jwt.verify(token, JWT_SECRET) as User;
		req.user = payload;

		// Viewer edit restrictions
		const editMethods = ['PUT', 'PATCH', 'DELETE', 'POST', 'OPTIONS'];
		if (editMethods.includes(req.method) && payload.role === Role.Viewer) {
			return res.status(403).json({ success: false, error: 'Forbidden: Viewer users cannot edit data' });
		}

		return next();
	} catch {
		return res.status(401).json({ success: false, error: 'Invalid or expired JWT token' });
	}
}
