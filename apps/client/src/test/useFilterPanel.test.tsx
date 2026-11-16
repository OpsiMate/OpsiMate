import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { FilterFacet } from '@/components/shared/FilterPanel';
import { useFilterPanel } from '@/components/shared/hooks/useFilterPanel';

const makeFacets = (prefix: string, count: number): FilterFacet[] =>
	Array.from({ length: count }, (_, index) => ({ value: `${prefix}-${index + 1}`, count: 1 }));

const values = (facets: FilterFacet[]): string[] => facets.map((facet) => facet.value);

afterEach(cleanup);

describe('useFilterPanel', () => {
	test('initially shows at most 6 facet values per field', () => {
		const { result } = renderHook(() => useFilterPanel());
		const facets = makeFacets('host', 10);

		const view = result.current.getFilteredAndLimitedFacets('host', facets);

		expect(values(view.filteredAndLimitedFacets)).toEqual(values(facets.slice(0, 6)));
		expect(view.hasMore).toBe(true);
		expect(view.remaining).toBe(4);
		expect(view.searchTerm).toBe('');
	});

	test('reports no more values when a field has 6 or fewer', () => {
		const { result } = renderHook(() => useFilterPanel());
		const facets = makeFacets('host', 6);

		const view = result.current.getFilteredAndLimitedFacets('host', facets);

		expect(view.filteredAndLimitedFacets).toHaveLength(6);
		expect(view.hasMore).toBe(false);
		expect(view.remaining).toBe(0);
	});

	test('handleLoadMore reveals 5 more values at a time', () => {
		const { result } = renderHook(() => useFilterPanel());
		const facets = makeFacets('host', 20);

		act(() => result.current.handleLoadMore('host'));
		let view = result.current.getFilteredAndLimitedFacets('host', facets);
		expect(view.filteredAndLimitedFacets).toHaveLength(11);
		expect(view.hasMore).toBe(true);
		expect(view.remaining).toBe(9);

		act(() => result.current.handleLoadMore('host'));
		view = result.current.getFilteredAndLimitedFacets('host', facets);
		expect(view.filteredAndLimitedFacets).toHaveLength(16);
		expect(view.remaining).toBe(4);

		act(() => result.current.handleLoadMore('host'));
		view = result.current.getFilteredAndLimitedFacets('host', facets);
		expect(view.filteredAndLimitedFacets).toHaveLength(20);
		expect(view.hasMore).toBe(false);
	});

	test('search is case-insensitive and matches value and displayValue', () => {
		const { result } = renderHook(() => useFilterPanel());
		const facets: FilterFacet[] = [
			{ value: 'Production', count: 3 },
			{ value: 'stg-01', displayValue: 'Staging', count: 2 },
			{ value: 'dev', displayValue: 'Development', count: 1 },
		];

		act(() => result.current.handleSearchChange('env', 'PROD'));
		let view = result.current.getFilteredAndLimitedFacets('env', facets);
		expect(values(view.filteredAndLimitedFacets)).toEqual(['Production']);
		expect(view.searchTerm).toBe('PROD');

		act(() => result.current.handleSearchChange('env', 'staging'));
		view = result.current.getFilteredAndLimitedFacets('env', facets);
		expect(values(view.filteredAndLimitedFacets)).toEqual(['stg-01']);

		act(() => result.current.handleSearchChange('env', 'DEV'));
		view = result.current.getFilteredAndLimitedFacets('env', facets);
		expect(values(view.filteredAndLimitedFacets)).toEqual(['dev']);
	});

	test('fields are independent of each other', () => {
		const { result } = renderHook(() => useFilterPanel());
		const hosts = makeFacets('host', 12);
		const services = makeFacets('service', 12);

		act(() => result.current.handleLoadMore('host'));
		act(() => result.current.handleSearchChange('service', 'service-1'));

		const hostView = result.current.getFilteredAndLimitedFacets('host', hosts);
		expect(hostView.filteredAndLimitedFacets).toHaveLength(11);
		expect(hostView.searchTerm).toBe('');

		const serviceView = result.current.getFilteredAndLimitedFacets('service', services);
		expect(values(serviceView.filteredAndLimitedFacets)).toEqual([
			'service-1',
			'service-10',
			'service-11',
			'service-12',
		]);
		expect(serviceView.searchTerm).toBe('service-1');
		expect(serviceView.hasMore).toBe(false);
	});
});
