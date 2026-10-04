import { Role, UserAuthSource } from '@OpsiMate/shared';

export { Role };

export interface User {
	id: number;
	email: string;
	fullName: string;
	role: Role;
	createdAt: string;
	authSource?: UserAuthSource;
}

export * from './TagKey';
