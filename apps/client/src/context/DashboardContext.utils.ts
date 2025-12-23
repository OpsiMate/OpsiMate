import { Logger } from '@OpsiMate/shared';
import { DashboardState, TimeRange } from './DashboardContext';

const logger = new Logger('DasbhoardContext.utils');

export const DASHBOARD_STORAGE_KEY = 'OpsiMate-active-dashboard';

interface SerializedTimeRange {
	from: string | null;
	to: string | null;
	preset: TimeRange['preset'];
}

const serializeTimeRange = (timeRange: TimeRange): SerializedTimeRange => ({
	from: timeRange.from?.toISOString() ?? null,
	to: timeRange.to?.toISOString() ?? null,
	preset: timeRange.preset,
});

const deserializeTimeRange = (stored: SerializedTimeRange | undefined): TimeRange => {
	if (!stored) {
		return { from: null, to: null, preset: null };
	}
	return {
		from: stored.from ? new Date(stored.from) : null,
		to: stored.to ? new Date(stored.to) : null,
		preset: stored.preset,
	};
};

export const loadFromStorage = (defaultState: DashboardState): DashboardState => {
	try {
		const stored = localStorage.getItem(DASHBOARD_STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			return {
				...defaultState,
				...parsed,
				timeRange: deserializeTimeRange(parsed.timeRange),
			};
		}
	} catch (e) {
		logger.warn('Failed to load dashboard from localStorage:', e);
	}
	return defaultState;
};

export const saveToStorage = (state: DashboardState): void => {
	try {
		const toStore = {
			...state,
			timeRange: serializeTimeRange(state.timeRange),
		};
		localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(toStore));
	} catch (e) {
		logger.warn('Failed to save dashboard to localStorage:', e);
	}
};

export const clearStorage = (): void => {
	localStorage.removeItem(DASHBOARD_STORAGE_KEY);
};
