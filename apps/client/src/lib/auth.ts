import { Logger, Role } from '@OpsiMate/shared';
import { jwtDecode } from 'jwt-decode';
import { getPlaygroundUser, isPlaygroundMode } from './playground';

const logger = new Logger('auth');

export interface JWTPayload {
	id: number;
	email: string;
	role: Role;
	iat: number;
	exp: number;
}

export function getCurrentUser(): JWTPayload | null {
	if (isPlaygroundMode()) {
		const playgroundUser = getPlaygroundUser();
		return {
			id: Number(playgroundUser.id) || 0,
			email: playgroundUser.email,
			role: playgroundUser.role,
			iat: 0,
			exp: 0,
		};
	}

	const token = localStorage.getItem('jwt');
	if (!token) return null;

	try {
		return jwtDecode<JWTPayload>(token);
	} catch (error) {
		logger.error('Failed to decode JWT token:', error);
		return null;
	}
}

export function isAdmin(): boolean {
	const user = getCurrentUser();
	return user?.role === Role.Admin;
}

export function isEditor(): boolean {
	const user = getCurrentUser();
	return user?.role === Role.Admin || user?.role === Role.Editor;
}

export function isViewer(): boolean {
	const user = getCurrentUser();
	return user?.role === Role.Viewer;
}
export function isOperation(): boolean {
	const user = getCurrentUser();
	return user?.role === Role.Operation;
}
export function getUserRole(): Role | null {
	const user = getCurrentUser();
	return user?.role || null;
}
