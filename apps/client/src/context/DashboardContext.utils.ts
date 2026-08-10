import { DashboardTimeRange, Logger } from '@OpsiMate/shared';
import { DashboardState, TimeRange } from './DashboardContext';

const logger = new Logger('DashboardContext.utils');

export const DASHBOARD_STORAGE_KEY = 'OpsiMate-active-dashboard';

// Where "Severity colors" lived before it became a dashboard field: a per-browser flag.
// It survives as the fallback for anything with no dashboard value of its own, so users
// who had it on don't lose it on upgrade.
const LEGACY_SEVERITY_COLORS_KEY = 'opsimate-alerts-severity-colors';

export const readLegacySeverityColors = (): boolean => {
	try {
		return localStorage.getItem(LEGACY_SEVERITY_COLORS_KEY) === 'true';
	} catch (e) {
		logger.warn('Failed to read the legacy severity-colors preference:', e);
		return false;
	}
};

// The state for a dashboard with no stored values of its own — first visit, or "New
// dashboard". Every such path goes through here so they agree: the legacy per-browser
// severity-colors preference applied everywhere, so a fresh draft keeps honouring it.
export const createFreshState = (defaultState: DashboardState): DashboardState => ({
	...defaultState,
	severityColors: readLegacySeverityColors(),
});

// Tolerates a missing timeRange: dashboard states built by older code paths (or persisted
// before the field existed) can lack it, and this runs inside DashboardProvider — above
// the router-scoped ErrorBoundary — where an exception used to mean a blank white page.
export const serializeTimeRange = (timeRange: TimeRange | undefined | null): DashboardTimeRange => ({
	from: timeRange?.from?.toISOString() ?? null,
	to: timeRange?.to?.toISOString() ?? null,
	preset: timeRange?.preset ?? null,
});

export const deserializeTimeRange = (stored: DashboardTimeRange | undefined): TimeRange => {
	if (!stored) {
		return { from: null, to: null, preset: null };
	}
	const preset = stored.preset as TimeRange['preset'];
	// Quick presets are rolling windows resolved at filter time; drop any absolute dates
	// that older versions froze in at click time (a saved "Today" from last week would
	// otherwise keep filtering last week forever). Only 'custom' keeps its dates.
	if (preset && preset !== 'custom') {
		return { from: null, to: null, preset };
	}
	return {
		from: stored.from ? new Date(stored.from) : null,
		to: stored.to ? new Date(stored.to) : null,
		preset,
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
				// A draft stored before severity colors became a dashboard field has no
				// opinion on it; inherit the old per-browser flag rather than silently
				// turning it off. Once the draft carries the field, it wins.
				severityColors:
					typeof parsed.severityColors === 'boolean' ? parsed.severityColors : readLegacySeverityColors(),
			};
		}
	} catch (e) {
		logger.warn('Failed to load dashboard from localStorage:', e);
	}
	// No stored draft (or an unreadable one). Both dashboardState and initialState load
	// through here, so they agree and the dashboard doesn't start out looking dirty.
	return createFreshState(defaultState);
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
