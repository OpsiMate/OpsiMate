import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { FAVORITES_STORAGE_KEY } from '@/components/Dashboards/Dashboards.constants';
import { DashboardWithFavorite } from '@/components/Dashboards/Dashboards.types';
import {
	getFavoriteDashboards,
	saveFavoriteDashboards,
	toggleFavorite,
	sortDashboardsByFavorite,
	filterDashboards,
} from '@/components/Dashboards/Dashboards.utils';

function dashboard(id: string, name: string, overrides: Partial<DashboardWithFavorite> = {}): DashboardWithFavorite {
	return {
		id,
		name,
		type: 'services',
		filters: {},
		visibleColumns: [],
		query: '',
		groupBy: [],
		isFavorite: false,
		...overrides,
	};
}

beforeEach(() => localStorage.clear());
afterEach(() => {
	vi.restoreAllMocks();
	localStorage.clear();
});

describe('dashboard favourite storage', () => {
	test('returns an empty list when storage is absent', () => {
		expect(getFavoriteDashboards()).toEqual([]);
	});
	test('recovers from malformed JSON without throwing', () => {
		localStorage.setItem(FAVORITES_STORAGE_KEY, '{broken');
		expect(getFavoriteDashboards()).toEqual([]);
	});
	test('recovers when storage access is denied', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('Access denied');
		});
		expect(getFavoriteDashboards()).toEqual([]);
	});
	test('round trips favourite IDs without modifying unrelated storage', () => {
		localStorage.setItem('unrelated', 'keep');
		saveFavoriteDashboards(['a', 'b']);
		expect(JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY)!)).toEqual(['a', 'b']);
		expect(getFavoriteDashboards()).toEqual(['a', 'b']);
		expect(localStorage.getItem('unrelated')).toBe('keep');
	});
	test('persists an empty list when favourites are cleared', () => {
		saveFavoriteDashboards(['a']);
		saveFavoriteDashboards([]);
		expect(localStorage.getItem(FAVORITES_STORAGE_KEY)).toBe('[]');
	});
});

describe('toggling dashboard favourites', () => {
	test('adds an absent ID and preserves the existing favourites', () => {
		localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(['a', 'c']));
		expect(toggleFavorite('b')).toEqual(['a', 'c', 'b']);
		expect(getFavoriteDashboards()).toEqual(['a', 'c', 'b']);
	});
	test('removes a present ID without removing neighbouring favourites', () => {
		localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(['a', 'b', 'c']));
		expect(toggleFavorite('b')).toEqual(['a', 'c']);
		expect(getFavoriteDashboards()).toEqual(['a', 'c']);
	});
	test('a second toggle removes the last favourite and persists the empty list', () => {
		expect(toggleFavorite('a')).toEqual(['a']);
		expect(toggleFavorite('a')).toEqual([]);
		expect(localStorage.getItem(FAVORITES_STORAGE_KEY)).toBe('[]');
	});
	test('repairs corrupt storage when adding a favourite', () => {
		localStorage.setItem(FAVORITES_STORAGE_KEY, '{broken');
		expect(toggleFavorite('a')).toEqual(['a']);
		expect(getFavoriteDashboards()).toEqual(['a']);
	});
});

describe('sorting dashboard favourites', () => {
	test('puts favourites first and alphabetizes each group without mutating input', () => {
		const input = [
			dashboard('n-z', 'Zulu'),
			dashboard('f-z', 'Zulu', { isFavorite: true }),
			dashboard('n-a', 'Alpha'),
			dashboard('f-a', 'Alpha', { isFavorite: true }),
		];
		const original = structuredClone(input);
		const result = sortDashboardsByFavorite(input);
		expect(result.map((d) => d.id)).toEqual(['f-a', 'f-z', 'n-a', 'n-z']);
		expect(input).toEqual(original);
		expect(result).not.toBe(input);
	});
	test('handles an empty list', () => {
		expect(sortDashboardsByFavorite([])).toEqual([]);
	});
});

describe('filtering dashboards', () => {
	const input = [
		dashboard('name', 'Production'),
		dashboard('description', 'Services', { description: 'Production incidents' }),
		dashboard('tag', 'Overview', {
			tags: [{ id: 1, name: 'Production', color: '#123456', createdAt: '2026-01-01' }],
		}),
		dashboard('other', 'Staging', { description: '', tags: [] }),
	];
	test.each(['production', 'PRODUCTION', 'pRoDuCtIoN', 'duct'])(
		'matches name, description and tag for %s',
		(term) => {
			const original = structuredClone(input);
			expect(filterDashboards(input, term).map((d) => d.id)).toEqual(['name', 'description', 'tag']);
			expect(input).toEqual(original);
		}
	);
	test.each(['', '   ', '\t\n'])('returns all dashboards for blank search %j', (term) => {
		expect(filterDashboards(input, term)).toEqual(input);
	});
	test('returns no matches and tolerates absent descriptions and tags', () => {
		expect(filterDashboards(input, 'missing')).toEqual([]);
	});
});
