import { Role, User } from '@OpsiMate/shared';
import { PLAYGROUND_QUERY_KEY } from './playground.constants';

const isBrowser = typeof window !== 'undefined';

export const isPlaygroundModeFromEnv = (): boolean => {
	return import.meta.env.VITE_PLAYGROUND_MODE === 'true';
};

export const isPlaygroundMode = (): boolean => {
	if (isPlaygroundModeFromEnv()) return true;
	if (!isBrowser) return false;
	const params = new URLSearchParams(window.location.search);
	const value = params.get(PLAYGROUND_QUERY_KEY);
	return value === '' || value === 'true';
};

export const getPlaygroundUser = (): User => ({
	id: '0',
	email: 'demo@opsimate.local',
	fullName: 'Playground Admin',
	role: Role.Admin,
	createdAt: new Date().toISOString(),
});
