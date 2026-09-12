import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useFilterPanel } from '../components/shared/hooks/useFilterPanel';
import type { FilterFacet } from '../components/shared/FilterPanel';

const makeFacets = (count: number, prefix = 'value'): FilterFacet[] =>
	Array.from({ length: count }, (_, i) => ({
		value: `${prefix}-${i}`,
		count: i,
	}));

describe('useFilterPanel', () => {
	test('shows at most 6 facet values initially, with hasMore/remaining reported correctly', () => {
		const { result } = renderHook(() => useFilterPanel());
		const facets = makeFacets(9);

		const { filteredAndLimitedFacets, hasMore, remaining } =
			result.current.getFilteredAndLimitedFacets('status', facets);

		expect(filteredAndLimitedFacets).toHaveLength(6);
		expect(filteredAndLimitedFacets).toEqual(facets.slice(0, 6));
		expect(hasMore).toBe(true);
		expect(remaining).toBe(3);
	});

	test('reports no more when facet count is within the initial limit', () => {
		const { result } = renderHook(() => useFilterPanel());
		const facets = makeFacets(4);

		const { filteredAndLimitedFacets, hasMore, remaining } =
			result.current.getFilteredAndLimitedFacets('status', facets);

		expect(filteredAndLimitedFacets).toHaveLength(4);
		expect(hasMore).toBe(false);
		// remaining isn't clamped by the hook, so it goes negative once the count is below the limit
		expect(remaining).toBe(-2);
	});

	test('handleLoadMore reveals 5 more at a time', () => {
		const { result } = renderHook(() => useFilterPanel());
		const facets = makeFacets(20);

		act(() => result.current.handleLoadMore('status'));
		let limited = result.current.getFilteredAndLimitedFacets('status', facets);
		expect(limited.filteredAndLimitedFacets).toHaveLength(11);
		expect(limited.hasMore).toBe(true);
		expect(limited.remaining).toBe(9);

		act(() => result.current.handleLoadMore('status'));
		limited = result.current.getFilteredAndLimitedFacets('status', facets);
		expect(limited.filteredAndLimitedFacets).toHaveLength(16);
		expect(limited.remaining).toBe(4);

		act(() => result.current.handleLoadMore('status'));
		limited = result.current.getFilteredAndLimitedFacets('status', facets);
		expect(limited.filteredAndLimitedFacets).toHaveLength(20);
		expect(limited.hasMore).toBe(false);
		// same unclamped formula as above: 20 facets - 21 revealed slots = -1
		expect(limited.remaining).toBe(-1);
	});

	test('search is case-insensitive and matches on value', () => {
		const { result } = renderHook(() => useFilterPanel());
		const facets: FilterFacet[] = [
			{ value: 'Running', count: 1 },
			{ value: 'stopped', count: 2 },
			{ value: 'Pending', count: 3 },
		];

		act(() => result.current.handleSearchChange('status', 'RUN'));
		const { filteredAndLimitedFacets, searchTerm } =
			result.current.getFilteredAndLimitedFacets('status', facets);

		expect(searchTerm).toBe('RUN');
		expect(filteredAndLimitedFacets).toEqual([{ value: 'Running', count: 1 }]);
	});

	test('search matches on displayValue as well as value', () => {
		const { result } = renderHook(() => useFilterPanel());
		const facets: FilterFacet[] = [
			{ value: 'us-east-1', count: 1, displayValue: 'US East' },
			{ value: 'eu-west-1', count: 2, displayValue: 'EU West' },
		];

		act(() => result.current.handleSearchChange('region', 'east'));
		const { filteredAndLimitedFacets } = result.current.getFilteredAndLimitedFacets(
			'region',
			facets,
		);

		expect(filteredAndLimitedFacets).toEqual([
			{ value: 'us-east-1', count: 1, displayValue: 'US East' },
		]);
	});

	test('a facet with no displayValue is not excluded by a value match', () => {
		const { result } = renderHook(() => useFilterPanel());
		const facets: FilterFacet[] = [{ value: 'match-me', count: 1 }];

		act(() => result.current.handleSearchChange('status', 'match'));
		const { filteredAndLimitedFacets } = result.current.getFilteredAndLimitedFacets(
			'status',
			facets,
		);

		expect(filteredAndLimitedFacets).toEqual(facets);
	});

	test('fields are independent for loading more', () => {
		const { result } = renderHook(() => useFilterPanel());
		const statusFacets = makeFacets(20, 'status');
		const regionFacets = makeFacets(20, 'region');

		act(() => result.current.handleLoadMore('status'));

		const status = result.current.getFilteredAndLimitedFacets('status', statusFacets);
		const region = result.current.getFilteredAndLimitedFacets('region', regionFacets);

		expect(status.filteredAndLimitedFacets).toHaveLength(11);
		expect(region.filteredAndLimitedFacets).toHaveLength(6);
	});

	test('fields are independent for search', () => {
		const { result } = renderHook(() => useFilterPanel());
		const statusFacets: FilterFacet[] = [
			{ value: 'running', count: 1 },
			{ value: 'stopped', count: 2 },
		];
		const regionFacets: FilterFacet[] = [
			{ value: 'us-east-1', count: 1 },
			{ value: 'eu-west-1', count: 2 },
		];

		act(() => result.current.handleSearchChange('status', 'run'));

		const status = result.current.getFilteredAndLimitedFacets('status', statusFacets);
		const region = result.current.getFilteredAndLimitedFacets('region', regionFacets);

		expect(status.filteredAndLimitedFacets).toEqual([{ value: 'running', count: 1 }]);
		expect(status.searchTerm).toBe('run');
		expect(region.filteredAndLimitedFacets).toEqual(regionFacets);
		expect(region.searchTerm).toBe('');
	});

	test('shouldShowSearch is true only when facets exceed the initial display limit', () => {
		const { result } = renderHook(() => useFilterPanel());

		expect(result.current.shouldShowSearch(makeFacets(6))).toBe(false);
		expect(result.current.shouldShowSearch(makeFacets(7))).toBe(true);
	});
});
