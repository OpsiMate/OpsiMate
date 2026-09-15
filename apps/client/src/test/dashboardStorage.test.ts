import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearStorage,
	createFreshState,
	DASHBOARD_STORAGE_KEY,
	deserializeTimeRange,
	loadFromStorage,
	saveToStorage,
	serializeTimeRange,
} from '@/context/DashboardContext.utils';
import type { DashboardState } from '@/context/DashboardContext';

const defaults = {
	id: null,
	name: '',
	type: 'alerts',
	timeRange: { from: null, to: null, preset: null },
} as DashboardState;

beforeEach(() => localStorage.clear());

describe('dashboard storage helpers', () => {
	it('keeps custom dates and drops frozen quick-range dates', () => {
		const from = new Date('2026-01-01T00:00:00Z');
		const to = new Date('2026-01-02T00:00:00Z');
		expect(deserializeTimeRange(serializeTimeRange({ from, to, preset: 'custom' }))).toEqual({
			from,
			to,
			preset: 'custom',
		});
		expect(deserializeTimeRange({ from: from.toISOString(), to: to.toISOString(), preset: 'last24Hours' })).toEqual(
			{ from: null, to: null, preset: 'last24Hours' }
		);
	});

	it('round-trips storage and clearStorage removes the saved draft', () => {
		const state = { ...defaults, name: 'Saved dashboard' };
		saveToStorage(state);
		expect(localStorage.getItem(DASHBOARD_STORAGE_KEY)).not.toBeNull();
		expect(loadFromStorage(defaults).name).toBe('Saved dashboard');
		clearStorage();
		expect(loadFromStorage(defaults).name).toBe('');
	});

	it('creates a fresh state object', () => {
		const fresh = createFreshState(defaults);
		expect(fresh).not.toBe(defaults);
	});
});
