import { Request, Response } from 'express';
import { z } from 'zod';
import { UserBL } from '../../../bl/users/user.bl';
import {CreateUserSchema, LoginSchema, RegisterSchema, UpdateUserRoleSchema} from '@service-peek/shared';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../../../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-secret';

export class UsersController {
    constructor(private userBL: UserBL) {}

    registerHandler = async (req: Request, res: Response) => {
        try {
            const { email, fullName, password } = RegisterSchema.parse(req.body);
            const result = await this.userBL.register(email, fullName, password);
            const token = jwt.sign(result, JWT_SECRET, { expiresIn: '7d' });
            res.status(201).json({ success: true, data: result, token });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else if (error instanceof Error && error.message === 'Registration is disabled after first admin') {
                res.status(403).json({ success: false, error: error.message });
            } else if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')) {
                res.status(400).json({ success: false, error: 'Email already registered' });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    createUserHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
        }
        try {
            const { email, fullName, password, role } = CreateUserSchema.parse(req.body);
            const result = await this.userBL.createUser(email, fullName, password, role);
            res.status(201).json({ success: true, data: result });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')) {
                res.status(400).json({ success: false, error: 'Email already registered' });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    updateUserRoleHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
        }
        try {
            const { email, newRole } = UpdateUserRoleSchema.parse(req.body);
            await this.userBL.updateUserRole(email, newRole);
            res.status(200).json({ success: true, message: 'User role updated successfully' });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    loginHandler = async (req: Request, res: Response) => {
        try {
            const { email, password } = LoginSchema.parse(req.body);
            const user = await this.userBL.login(email, password);
            const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
            res.status(200).json({ success: true, data: user, token });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else if (error instanceof Error && error.message === 'Invalid email or password') {
                res.status(401).json({ success: false, error: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    getAllUsersHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
        }
        try {
            const users = await this.userBL.getAllUsers();
            res.status(200).json({ success: true, data: users });
        } catch {
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    /**
     * Checks if any users exist in the database.
     * Returns { exists: true } if at least one user exists, otherwise { exists: false }.
     */
    usersExistHandler = async (req: Request, res: Response) => {
        try {
            const exists = await this.userBL.usersExist();
            res.status(200).json({ success: true, exists });
        } catch {
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };
} 