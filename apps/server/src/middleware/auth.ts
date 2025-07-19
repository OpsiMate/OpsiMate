// JWT authentication middleware for Express
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {User} from "@service-peek/shared";

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
        next();
    } catch {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
} 