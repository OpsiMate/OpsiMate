import { Role, UserAuthSource } from '@OpsiMate/shared';

export { Role };

export interface User {
	id: number;
	// The login name; unique, lowercase.
	username: string;
	// Contact address; null for an account without one.
	email: string | null;
	fullName: string;
	role: Role;
	createdAt: string;
	authSource?: UserAuthSource;
}

export * from './TagKey';
