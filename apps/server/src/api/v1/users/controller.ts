import { Request, Response } from 'express';
import { isZodError } from '../../../utils/isZodError.js';
import { UserBL } from '../../../bl/users/user.bl.js';
import {CreateUserSchema, Logger, LoginSchema, RegisterSchema, Role, UpdateUserRoleSchema, UpdateProfileSchema, ForgotPasswordSchema, ValidateResetTokenSchema, ResetPasswordSchema} from '@OpsiMate/shared';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../../../middleware/auth.js';
import { User } from '@OpsiMate/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-secret';
const logger = new Logger('api/v1/users/controller');

export class UsersController {
    constructor(private userBL: UserBL) {}

    registerHandler = async (req: Request, res: Response) => {
        try {
            const { email, fullName, password } = RegisterSchema.parse(req.body);
            const result = await this.userBL.register(email, fullName, password);
            const token = jwt.sign(result, JWT_SECRET, { expiresIn: '7d' });
            return res.status(201).json({ success: true, data: result, token });
        } catch (error) {
            if (isZodError(error)) {
                return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else if (error instanceof Error && error.message === 'Registration is disabled after first admin') {
                return res.status(403).json({ success: false, error: error.message });
            } else if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')) {
                return res.status(400).json({ success: false, error: 'Email already registered' });
            } else {
                return res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    createUserHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user || req.user.role !== Role.Admin) {
            return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
        }
        try {
            const { email, fullName, password, role } = CreateUserSchema.parse(req.body);
            const result = await this.userBL.createUser(email, fullName, password, role);
            return res.status(201).json({ success: true, data: result });
        } catch (error) {
            if (isZodError(error)) {
                return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')) {
                return res.status(400).json({ success: false, error: 'Email already registered' });
            } else {
                return res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    updateUserRoleHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user || req.user.role !== Role.Admin) {
            return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
        }
        try {
            const { email, newRole } = UpdateUserRoleSchema.parse(req.body);
            await this.userBL.updateUserRole(email, newRole);
            return res.status(200).json({ success: true, message: 'User role updated successfully' });
        } catch (error) {
            if (isZodError(error)) {
                return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else {
                return res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    loginHandler = async (req: Request, res: Response) => {
        try {
            const { email, password } = LoginSchema.parse(req.body);
            const user = await this.userBL.login(email, password);
            const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
            return res.status(200).json({ success: true, data: user, token });
        } catch (error) {
            if (isZodError(error)) {
                return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else if (error instanceof Error && error.message === 'Invalid email or password') {
                return res.status(401).json({ success: false, error: error.message });
            } else {
                return res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    getAllUsersHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user || req.user.role !== Role.Admin) {
            return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
        }
        try {
            const users = await this.userBL.getAllUsers();
            return res.status(200).json({ success: true, data: users });
        } catch {
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    deleteUserHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user || req.user.role !== Role.Admin) {
            return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
        }
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, error: 'Invalid user ID' });
        }
        try {
            const user = await this.userBL.getUserById(userId);
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            await this.userBL.deleteUser(userId);
            return res.status(200).json({ success: true, message: 'User deleted successfully' });
        } catch (error) {
            logger.error('Error deleting user:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    /**
     * Checks if any users exist in the database.
     * Returns { exists: true } if at least one user exists, otherwise { exists: false }.
     */
    usersExistHandler = async (req: Request, res: Response) => {
        try {
            const exists = await this.userBL.usersExist();
            return res.status(200).json({ success: true, exists });
        } catch {
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    getProfileHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        try {
            const user = await this.userBL.getUserById(req.user.id);
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            
            return res.status(200).json({ success: true, data: user });
        } catch (error) {
            logger.error('Error fetching profile:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    updateProfileHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        try {
            const { fullName, newPassword } = UpdateProfileSchema.parse(req.body);
            const updatedUser = await this.userBL.updateProfile(req.user.id, fullName, newPassword);
            
            const responseData: { user: User; token?: string | undefined } = { user: updatedUser };
            
            // If password was changed, generate a new token
            if (newPassword) {
                const token = jwt.sign(updatedUser, JWT_SECRET, { expiresIn: '7d' });
                responseData.token = token;
            }
            
            return res.status(200).json({ success: true, data: responseData });
        } catch (error) {
            if (isZodError(error)) {
                return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else if (error instanceof Error && error.message === 'User not found') {
                return res.status(404).json({ success: false, error: error.message });
            } else {
                logger.error('Error updating profile:', error);
                return res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    updateUserPasswordHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user || req.user.role !== Role.Admin) {
            return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
        }

        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, error: 'Invalid user ID' });
        }

        try {
            const { newPassword } = req.body as { newPassword: string };

            if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    error: 'Password must be at least 8 characters long'
                });
            }
            
            // Don't allow admin to reset their own password this way
            if (userId === req.user.id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot reset your own password. Use profile settings instead.'
                });
            }

            const user = await this.userBL.getUserById(userId);
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }

            await this.userBL.resetUserPassword(userId, newPassword);

            return res.status(200).json({
                success: true,
                message: 'Password reset successfully'
            });
        } catch (error) {
            logger.error('Error resetting user password:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    updateUserHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user || req.user.role !== Role.Admin) {
            return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
        }

        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, error: 'Invalid user ID' });
        }

        try {
            const { fullName, email, role } = req.body as {
                fullName?: string;
                email?: string;
                role?: Role;
            };

            // Validate at least one field is provided
            if (!fullName && !email && !role) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one field (fullName, email, or role) must be provided'
                });
            }

            const user = await this.userBL.getUserById(userId);
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }

            const updatedUser = await this.userBL.updateUser(userId, { fullName, email, role });

            return res.status(200).json({
                success: true,
                data: updatedUser,
                message: 'User updated successfully'
            });
        } catch (error) {
            if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')) {
                return res.status(400).json({ success: false, error: 'Email already registered' });
            } else {
                logger.error('Error updating user:', error);
                return res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    }

    forgotPasswordHandler = async (req: Request, res: Response) => {
        try {
            const { email } = ForgotPasswordSchema.parse(req.body);
            await this.userBL.forgotPassword(email);
            return res.status(200).json({ success: true, message: 'Password reset email sent' });
        } catch (error) {
            if (isZodError(error)) {
                return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            }

            logger.error('Error processing forgot password request:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    validateResetPasswordTokenHandler = async (req: Request, res: Response) => {
        try {
            const { token } = ValidateResetTokenSchema.parse(req.body);
            const isValid = await this.userBL.validateResetPasswordToken(token);
            if (!isValid) {
                return res.status(400).json({ success: false, error: 'Invalid or expired token' });
            }
            return res.status(200).json({ success: true, message: 'Token is valid' });
        } catch (error) {
            logger.error('Error validating reset password token:', error);
            if (isZodError(error)) {
                return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            }
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    resetPasswordHandler = async (req: Request, res: Response) => {
        try {
            const { token, newPassword } = ResetPasswordSchema.parse(req.body);
            await this.userBL.resetPassword(token, newPassword);
            return res.status(200).json({ success: true, message: 'Password has been reset successfully' });
        } catch (error) {
            logger.error('Error resetting password:', error);
            
            if (isZodError(error)) {
                return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            }
            
            if (error instanceof Error && (
                error.message === 'Invalid or expired token' || 
                error.message === 'User not found' ||
                error.message === 'You cannot reuse an old password')
            ) {
                return res.status(400).json({ success: false, error: error.message });
            } else {
                return res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    }
};