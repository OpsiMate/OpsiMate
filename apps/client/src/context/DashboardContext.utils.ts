import { DashboardState } from './DashboardContext';

export const DASHBOARD_STORAGE_KEY = 'OpsiMate-active-dashboard';

export const loadFromStorage = (defaultState: DashboardState): DashboardState => {
	try {
		const stored = localStorage.getItem(DASHBOARD_STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			return { ...defaultState, ...parsed };
		}
	} catch (e) {
		console.warn('Failed to load dashboard from localStorage:', e);
	}
	return defaultState;
};

export const saveToStorage = (state: DashboardState): void => {
	try {
		localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		console.warn('Failed to save dashboard to localStorage:', e);
	}
};

export const clearStorage = (): void => {
	localStorage.removeItem(DASHBOARD_STORAGE_KEY);
};
