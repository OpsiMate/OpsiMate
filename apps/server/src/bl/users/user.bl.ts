import { UserRepository } from '../../dal/userRepository';
import bcrypt from 'bcrypt';
import { Role, User } from '@service-peek/shared';

export class UserBL {
    constructor(private userRepo: UserRepository) {}

    async register(email: string, fullName: string, password: string): Promise<User> {
        const userCount = await this.userRepo.countUsers();
        if (userCount > 0) {
            throw new Error('Registration is disabled after first admin');
        }
        const hash = await bcrypt.hash(password, 10);
        const result = await this.userRepo.createUser(email, hash, fullName, 'admin');
        return { id: result.lastID, email, role: Role.Admin, fullName, createdAt: Date.now().toString() };
    }

    async createUser(email: string, fullName: string, password: string, role: Role): Promise<User> {
        const hash = await bcrypt.hash(password, 10);
        const result = await this.userRepo.createUser(email, hash, fullName, role);
        return { id: result.lastID, email, role: Role.Admin, fullName, createdAt: Date.now().toString() };
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

    async getAllUsers(): Promise<User[]> {
        return await this.userRepo.getAllUsers()
    }

    /**
     * Returns true if any users exist in the database, otherwise false.
     */
    async usersExist(): Promise<boolean> {
        const count = await this.userRepo.countUsers();
        return count > 0;
    }
} 