import { Role } from '@OpsiMate/shared';

export { Role } from '@OpsiMate/shared';

export interface User {
	id: number;
	email: string;
	fullName: string;
	role: Role;
	createdAt: string;
}

export * from './TagKey';
