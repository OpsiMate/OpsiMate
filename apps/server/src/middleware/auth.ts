// JWT authentication middleware for Express
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role, User } from '@OpsiMate/shared';
import { ApiKeyBL } from '../bl/apiKeys/apiKey.bl';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-secret';

export interface AuthenticatedRequest extends Request {
    user?: User;
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET) as User;
        req.user = payload;

        const editMethods = ['PUT', 'PATCH', 'DELETE', 'POST', 'OPTIONS'];
        if (editMethods.includes(req.method) && payload.role === Role.Viewer) {
            return res.status(403).json({ success: false, error: 'Forbidden: Viewer users cannot edit data' });
        }

        next();
    } catch {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}

export function createApiKeyAuthMiddleware(apiKeyBL: ApiKeyBL) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
        }

        const token = authHeader.split(' ')[1];

        // First try JWT authentication
        try {
            const payload = jwt.verify(token, JWT_SECRET) as User;
            req.user = payload;

            const editMethods = ['PUT', 'PATCH', 'DELETE', 'POST', 'OPTIONS'];
            if (editMethods.includes(req.method) && payload.role === Role.Viewer) {
                return res.status(403).json({ success: false, error: 'Forbidden: Viewer users cannot edit data' });
            }

            return next();
        } catch {
            // JWT failed, try API key authentication
            try {
                const apiKey = await apiKeyBL.validateApiKey(token);
                if (!apiKey) {
                    return res.status(401).json({ success: false, error: 'Invalid or expired API key' });
                }

                // Get user information for the API key
                const user = await apiKeyBL.getUserById(apiKey.userId);
                if (!user) {
                    return res.status(401).json({ success: false, error: 'User not found for API key' });
                }

                req.user = user;

                const editMethods = ['PUT', 'PATCH', 'DELETE', 'POST', 'OPTIONS'];
                if (editMethods.includes(req.method) && user.role === Role.Viewer) {
                    return res.status(403).json({ success: false, error: 'Forbidden: Viewer users cannot edit data' });
                }

                return next();
            } catch {
                return res.status(401).json({ success: false, error: 'Invalid or expired token' });
            }
        }
    };
}