import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DashboardTimeRange } from '@OpsiMate/shared';
import { DashboardState, TimeRange } from '@/context/DashboardContext';
import {
	clearStorage,
	createFreshState,
	DASHBOARD_STORAGE_KEY,
	deserializeTimeRange,
	loadFromStorage,
	readLegacySeverityColors,
	saveToStorage,
	serializeTimeRange,
} from '@/context/DashboardContext.utils';

const LEGACY_KEY = 'opsimate-alerts-severity-colors';

const mockDefaultState: DashboardState = {
	id: null,
	name: 'Default Dashboard',
	type: 'alerts',
	description: 'Test default state description',
	visibleColumns: ['title', 'severity'],
	filters: {},
	columnOrder: ['title', 'severity'],
	columnWidths: {},
	splitByAssignment: false,
	severityColors: false,
	groupBy: [],
	query: '',
	timeRange: { from: null, to: null, preset: null },
};

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});

describe('readLegacySeverityColors', () => {
	test('returns true when legacy preference in localStorage is "true"', () => {
		localStorage.setItem(LEGACY_KEY, 'true');
		expect(readLegacySeverityColors()).toBe(true);
	});

	test('returns false when legacy preference in localStorage is "false"', () => {
		localStorage.setItem(LEGACY_KEY, 'false');
		expect(readLegacySeverityColors()).toBe(false);
	});

	test('returns false when legacy preference is not present in localStorage', () => {
		expect(readLegacySeverityColors()).toBe(false);
	});

	test('returns false and catches error when localStorage.getItem throws', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
			throw new Error('Access denied');
		});
		expect(readLegacySeverityColors()).toBe(false);
	});
});

describe('serializeTimeRange', () => {
	test('returns null fields when timeRange is null or undefined', () => {
		expect(serializeTimeRange(null)).toEqual({ from: null, to: null, preset: null });
		expect(serializeTimeRange(undefined)).toEqual({ from: null, to: null, preset: null });
	});

	test('serializes valid Date objects into ISO strings and preserves preset', () => {
		const fromDate = new Date('2026-03-15T10:00:00.000Z');
		const toDate = new Date('2026-03-15T18:00:00.000Z');
		const range: TimeRange = { from: fromDate, to: toDate, preset: 'custom' };

		expect(serializeTimeRange(range)).toEqual({
			from: '2026-03-15T10:00:00.000Z',
			to: '2026-03-15T18:00:00.000Z',
			preset: 'custom',
		});
	});

	test('handles quick presets with null dates', () => {
		const quickRange: TimeRange = { from: null, to: null, preset: 'last24h' };
		expect(serializeTimeRange(quickRange)).toEqual({
			from: null,
			to: null,
			preset: 'last24h',
		});
	});
});

describe('deserializeTimeRange', () => {
	test('returns default empty time range when input is undefined', () => {
		expect(deserializeTimeRange(undefined)).toEqual({ from: null, to: null, preset: null });
	});

	test('drops frozen dates for quick presets to keep them dynamic on reload', () => {
		const stored: DashboardTimeRange = {
			from: '2026-01-01T00:00:00.000Z',
			to: '2026-01-02T00:00:00.000Z',
			preset: 'last24h',
		};
		expect(deserializeTimeRange(stored)).toEqual({
			from: null,
			to: null,
			preset: 'last24h',
		});
	});

	test('preserves from and to as Date instances for custom preset', () => {
		const stored: DashboardTimeRange = {
			from: '2026-05-10T08:00:00.000Z',
			to: '2026-05-10T18:00:00.000Z',
			preset: 'custom',
		};
		const result = deserializeTimeRange(stored);

		expect(result.preset).toBe('custom');
		expect(result.from).toBeInstanceOf(Date);
		expect(result.from?.toISOString()).toBe('2026-05-10T08:00:00.000Z');
		expect(result.to).toBeInstanceOf(Date);
		expect(result.to?.toISOString()).toBe('2026-05-10T18:00:00.000Z');
	});

	test('handles custom preset with missing dates as null', () => {
		const stored: DashboardTimeRange = { from: null, to: null, preset: 'custom' };
		expect(deserializeTimeRange(stored)).toEqual({ from: null, to: null, preset: 'custom' });
	});

	test('sets preset to null for unknown preset while reviving dates if present', () => {
		const stored = {
			from: '2026-06-01T12:00:00.000Z',
			to: '2026-06-01T14:00:00.000Z',
			preset: 'non_existent_preset',
		} as unknown as DashboardTimeRange;
		const result = deserializeTimeRange(stored);

		expect(result.preset).toBeNull();
		expect(result.from).toBeInstanceOf(Date);
		expect(result.from?.toISOString()).toBe('2026-06-01T12:00:00.000Z');
		expect(result.to).toBeInstanceOf(Date);
		expect(result.to?.toISOString()).toBe('2026-06-01T14:00:00.000Z');
	});
});

describe('createFreshState', () => {
	test('creates a shallow copy of defaultState with severityColors set from legacy preference', () => {
		localStorage.setItem(LEGACY_KEY, 'true');
		const fresh = createFreshState(mockDefaultState);

		expect(fresh.severityColors).toBe(true);
		expect(fresh.name).toBe(mockDefaultState.name);
		expect(fresh).not.toBe(mockDefaultState);
	});

	test('mutating fresh state does not mutate defaultState', () => {
		const fresh = createFreshState(mockDefaultState);
		fresh.name = 'Mutated Dashboard Name';
		fresh.severityColors = true;

		expect(mockDefaultState.name).toBe('Default Dashboard');
		expect(mockDefaultState.severityColors).toBe(false);
	});
});

describe('saveToStorage and clearStorage', () => {
	test('saveToStorage writes serialized dashboard state to localStorage under DASHBOARD_STORAGE_KEY', () => {
		const stateToSave: DashboardState = {
			...mockDefaultState,
			name: 'Production Alerts',
			timeRange: {
				from: new Date('2026-04-01T00:00:00.000Z'),
				to: new Date('2026-04-02T00:00:00.000Z'),
				preset: 'custom',
			},
		};

		saveToStorage(stateToSave);

		const storedRaw = localStorage.getItem(DASHBOARD_STORAGE_KEY);
		expect(storedRaw).not.toBeNull();
		const parsed = JSON.parse(storedRaw!);
		expect(parsed.name).toBe('Production Alerts');
		expect(parsed.timeRange).toEqual({
			from: '2026-04-01T00:00:00.000Z',
			to: '2026-04-02T00:00:00.000Z',
			preset: 'custom',
		});
	});

	test('saveToStorage catches errors gracefully if localStorage.setItem throws', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
			throw new Error('QuotaExceededError');
		});

		expect(() => saveToStorage(mockDefaultState)).not.toThrow();
	});

	test('clearStorage removes DASHBOARD_STORAGE_KEY from localStorage', () => {
		saveToStorage(mockDefaultState);
		expect(localStorage.getItem(DASHBOARD_STORAGE_KEY)).not.toBeNull();

		clearStorage();
		expect(localStorage.getItem(DASHBOARD_STORAGE_KEY)).toBeNull();
	});
});

describe('loadFromStorage', () => {
	test('returns fresh state when storage is empty', () => {
		const loaded = loadFromStorage(mockDefaultState);
		expect(loaded).toEqual(mockDefaultState);
		expect(loaded).not.toBe(mockDefaultState);
	});

	test('correctly deserializes stored dashboard and its timeRange', () => {
		const storedData = {
			...mockDefaultState,
			name: 'Loaded Dashboard',
			severityColors: true,
			timeRange: {
				from: '2026-05-01T00:00:00.000Z',
				to: '2026-05-02T00:00:00.000Z',
				preset: 'custom',
			},
		};
		localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(storedData));

		const loaded = loadFromStorage(mockDefaultState);
		expect(loaded.name).toBe('Loaded Dashboard');
		expect(loaded.severityColors).toBe(true);
		expect(loaded.timeRange.preset).toBe('custom');
		expect(loaded.timeRange.from).toBeInstanceOf(Date);
		expect(loaded.timeRange.from?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
	});

	test('inherits legacy severityColors when stored draft lacks the field', () => {
		localStorage.setItem(LEGACY_KEY, 'true');
		const storedWithoutSeverity = {
			name: 'Old Saved Dashboard',
			query: 'service:api',
		};
		localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(storedWithoutSeverity));

		const loaded = loadFromStorage(mockDefaultState);
		expect(loaded.name).toBe('Old Saved Dashboard');
		expect(loaded.query).toBe('service:api');
		expect(loaded.severityColors).toBe(true);
	});

	test('falls back to fresh state when localStorage has invalid JSON', () => {
		localStorage.setItem(DASHBOARD_STORAGE_KEY, '{invalid-json');

		const loaded = loadFromStorage(mockDefaultState);
		expect(loaded.name).toBe(mockDefaultState.name);
	});

	test('falls back to fresh state when localStorage.getItem throws', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
			throw new Error('SecurityError');
		});

		const loaded = loadFromStorage(mockDefaultState);
		expect(loaded.name).toBe(mockDefaultState.name);
	});
});
