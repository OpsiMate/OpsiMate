import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useServiceFilters } from './useServiceFilters';
import { BrowserRouter } from 'react-router-dom';
import type { SavedView } from '@/types/SavedView';

const wrapper = ({ children }: { children: React.ReactNode }) => <BrowserRouter>{children}</BrowserRouter>;

describe('useServiceFilters', () => {
	const mockSetActiveView = vi.fn();
	const mockSavedViews: SavedView[] = [
		{
			id: 'view-1',
			name: 'Test View',
			filters: { serviceStatus: ['running'] },
			visibleColumns: {},
			searchTerm: 'test',
			createdAt: '2024-01-01',
		},
	];

	beforeEach(() => {
		mockSetActiveView.mockClear();
		window.history.pushState({}, '', '/');
	});

	it('initializes with empty filters', () => {
		const { result } = renderHook(
			() =>
				useServiceFilters({
					activeViewId: undefined,
					savedViews: [],
					setActiveView: mockSetActiveView,
				}),
			{ wrapper }
		);

		expect(result.current.filters).toEqual({});
		expect(result.current.searchTerm).toBe('');
	});

	it('initializes from URL parameters', async () => {
		window.history.pushState({}, '', '/?serviceStatus=running&search=test');

		const { result } = renderHook(
			() =>
				useServiceFilters({
					activeViewId: undefined,
					savedViews: [],
					setActiveView: mockSetActiveView,
				}),
			{ wrapper }
		);

		await waitFor(() => {
			expect(result.current.isInitialized).toBe(true);
		});

		expect(result.current.filters).toEqual({ serviceStatus: ['running'] });
		expect(result.current.searchTerm).toBe('test');
	});

	it('initializes from active view', async () => {
		const { result } = renderHook(
			() =>
				useServiceFilters({
					activeViewId: 'view-1',
					savedViews: mockSavedViews,
					setActiveView: mockSetActiveView,
				}),
			{ wrapper }
		);

		await waitFor(() => {
			expect(result.current.isInitialized).toBe(true);
		});

		expect(result.current.filters).toEqual({ serviceStatus: ['running'] });
		expect(result.current.searchTerm).toBe('test');
	});

	it('updates URL when filters change', async () => {
		const { result } = renderHook(
			() =>
				useServiceFilters({
					activeViewId: undefined,
					savedViews: [],
					setActiveView: mockSetActiveView,
				}),
			{ wrapper }
		);

		await waitFor(() => {
			expect(result.current.isInitialized).toBe(true);
		});

		result.current.handleFiltersChange({ serviceStatus: ['running'] });

		await waitFor(() => {
			expect(window.location.search).toContain('serviceStatus=running');
		});
	});

	it('clears active view when filters change', async () => {
		const { result } = renderHook(
			() =>
				useServiceFilters({
					activeViewId: 'view-1',
					savedViews: mockSavedViews,
					setActiveView: mockSetActiveView,
				}),
			{ wrapper }
		);

		await waitFor(() => {
			expect(result.current.isInitialized).toBe(true);
		});

		result.current.handleFiltersChange({ serviceStatus: ['stopped'] });

		expect(mockSetActiveView).toHaveBeenCalledWith(undefined);
	});

	it('applies view filters and clears URL', async () => {
		window.history.pushState({}, '', '/?serviceStatus=running');

		const { result } = renderHook(
			() =>
				useServiceFilters({
					activeViewId: undefined,
					savedViews: mockSavedViews,
					setActiveView: mockSetActiveView,
				}),
			{ wrapper }
		);

		await waitFor(() => {
			expect(result.current.isInitialized).toBe(true);
		});

		result.current.applyViewFilters(mockSavedViews[0]);

		await waitFor(() => {
			expect(result.current.filters).toEqual({ serviceStatus: ['running'] });
			expect(result.current.searchTerm).toBe('test');
			expect(window.location.search).toBe('');
		});
	});

	it('handles search term changes and updates URL', async () => {
		const { result } = renderHook(
			() =>
				useServiceFilters({
					activeViewId: undefined,
					savedViews: [],
					setActiveView: mockSetActiveView,
				}),
			{ wrapper }
		);

		await waitFor(() => {
			expect(result.current.isInitialized).toBe(true);
		});

		result.current.handleSearchTermChange('new search');

		await waitFor(() => {
			expect(result.current.searchTerm).toBe('new search');
			expect(window.location.search).toContain('search=new');
		});
	});
});
