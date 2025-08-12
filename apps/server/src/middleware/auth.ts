// JWT authentication middleware for Express
import {NextFunction, Request, Response} from 'express';
import jwt from 'jsonwebtoken';
import {Role, User} from "@OpsiMate/shared";

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
            return res.status(401).json({ success: false, error: 'Unauthorized: Viewer users cannot edit data' });
        }

        next();
    } catch {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
} 