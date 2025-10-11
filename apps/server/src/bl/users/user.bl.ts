import { UserRepository } from '../../dal/userRepository.js';
import bcrypt from 'bcrypt';
import { Role, User } from '@OpsiMate/shared';

export class UserBL {
    constructor(private userRepo: UserRepository) {}

    async register(email: string, fullName: string, password: string): Promise<User> {
        const userCount = await this.userRepo.countUsers();
        if (userCount > 0) {
            throw new Error('Registration is disabled after first admin');
        }
        const hash = await bcrypt.hash(password, 10);
        const result = await this.userRepo.createUser(email, hash, fullName, 'admin');
        const user = await this.userRepo.getUserById(result.lastID);
        if (!user) throw new Error('User creation failed');
        return user;
    }

    async createUser(email: string, fullName: string, password: string, role: Role): Promise<User> {
        const hash = await bcrypt.hash(password, 10);
        const result = await this.userRepo.createUser(email, hash, fullName, role);
        const user = await this.userRepo.getUserById(result.lastID);
        if (!user) throw new Error('User creation failed');
        return user;
    }

    async updateUserRole(email: string, newRole: Role): Promise<void> {
        await this.userRepo.updateUserRole(email, newRole);
    }

    async login(email: string, password: string): Promise<User> {
        const user = await this.userRepo.loginVerification(email);
        if (!user) {
            throw new Error('Invalid email or password');
        }
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            throw new Error('Invalid email or password');
        }
        return user.user;
    }

    async resetUserPassword(userId: number, newPassword: string): Promise<void> {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.userRepo.updateUserPassword(userId, hashedPassword);
    }

    async updateUser(userId: number, updates: { fullName?: string; email?: string; role?: Role }): Promise<User> {
        await this.userRepo.updateUser(userId, updates);
        const updatedUser = await this.userRepo.getUserById(userId);
        if (!updatedUser) {
            throw new Error('User not found');
        }
        return updatedUser;
    }

    async getAllUsers(): Promise<User[]> {
        return await this.userRepo.getAllUsers()
    }

    async deleteUser(id: number): Promise<void> {
        await this.userRepo.deleteUser(id);
    }

    async getUserById(id: number): Promise<User | null> {
        return this.userRepo.getUserById(id);
    }

    /**
     * Returns true if any users exist in the database, otherwise false.
     */
    async usersExist(): Promise<boolean> {
        const count = await this.userRepo.countUsers();
        return count > 0;
    }

    async updateProfile(id: number, fullName: string, newPassword?: string): Promise<User> {
        let passwordHash: string | undefined;
        if (newPassword) {
            passwordHash = await bcrypt.hash(newPassword, 10);
        }
        
        await this.userRepo.updateUserProfile(id, fullName, passwordHash);
        const updatedUser = await this.userRepo.getUserById(id);
        if (!updatedUser) {
            throw new Error('User not found');
        }
        return updatedUser;
    }
}