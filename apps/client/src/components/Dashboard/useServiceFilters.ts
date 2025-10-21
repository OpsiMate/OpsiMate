import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filters } from './FilterPanel';
import { SavedView } from '@/types/SavedView';

interface UseServiceFiltersProps {
  activeViewId?: string;
  savedViews: SavedView[];
  setActiveView: (id: string | undefined) => Promise<void>;
}

interface UseServiceFiltersReturn {
  filters: Filters;
  searchTerm: string;
  isInitialized: boolean;
  handleFiltersChange: (newFilters: Filters) => void;
  handleSearchTermChange: (newSearchTerm: string) => void;
  applyViewFilters: (view: SavedView) => void;
}

export function useServiceFilters({
  activeViewId,
  savedViews,
  setActiveView,
}: UseServiceFiltersProps): UseServiceFiltersReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const serializeFiltersToUrl = useCallback((filters: Filters, search: string) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, values]) => {
      if (Array.isArray(values) && values.length > 0) {
        params.set(key, values.join(','));
      }
    });
    if (search) {
      params.set('search', search);
    }
    return params;
  }, []);

  const deserializeFiltersFromUrl = useCallback(() => {
    const filters: Filters = {};
    const search = searchParams.get('search') || '';

    searchParams.forEach((value, key) => {
      if (key !== 'search' && value) {
        filters[key] = value.split(',');
      }
    });

    return { filters, search };
  }, [searchParams]);

  const hasUrlParams = Array.from(searchParams.keys()).length > 0;

  const updateUrlParams = useCallback(
    (newFilters: Filters, newSearch: string) => {
      const params = serializeFiltersToUrl(newFilters, newSearch);
      if (params.toString()) {
        setSearchParams(params, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    },
    [serializeFiltersToUrl, setSearchParams]
  );

  const initializeFilters = useCallback(
    (urlFilters: Filters, urlSearch: string) => {
      setFilters(urlFilters);
      setSearchTerm(urlSearch);
      setActiveView(undefined);
    },
    [setActiveView]
  );

  useEffect(() => {
    if (isInitialized) {
      return;
    }

    if (hasUrlParams) {
      const { filters: urlFilters, search: urlSearch } = deserializeFiltersFromUrl();
      initializeFilters(urlFilters, urlSearch);
    } else if (activeViewId && savedViews.length > 0) {
      const activeView = savedViews.find(view => view.id === activeViewId);
      if (activeView) {
        initializeFilters(activeView.filters, activeView.searchTerm);
      }
    }

    setIsInitialized(true);
  }, [
    hasUrlParams,
    deserializeFiltersFromUrl,
    activeViewId,
    savedViews,
    isInitialized,
    initializeFilters,
  ]);

  const handleFiltersChange = useCallback(
    (newFilters: Filters) => {
      setFilters(newFilters);
      updateUrlParams(newFilters, searchTerm);
      setActiveView(undefined);
    },
    [updateUrlParams, searchTerm, setActiveView]
  );

  const handleSearchTermChange = useCallback(
    (newSearchTerm: string) => {
      setSearchTerm(newSearchTerm);
      updateUrlParams(filters, newSearchTerm);
      if (activeViewId) {
        setActiveView(undefined);
      }
    },
    [updateUrlParams, filters, activeViewId, setActiveView]
  );

  const applyViewFilters = useCallback(
    (view: SavedView) => {
      setFilters(view.filters);
      setSearchTerm(view.searchTerm);
      setSearchParams({}, { replace: true });
    },
    [setSearchParams]
  );

  return {
    filters,
    searchTerm,
    isInitialized,
    handleFiltersChange,
    handleSearchTermChange,
    applyViewFilters,
  };
}
