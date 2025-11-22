import { useState } from 'react';
import { FilterFacets } from '../FilterPanel';

const INITIAL_DISPLAY_LIMIT = 6;
const LOAD_MORE_INCREMENT = 5;

export const useFilterPanel = () => {
	const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
	const [displayCounts, setDisplayCounts] = useState<Record<string, number>>({});

	const getFilteredAndLimitedFacets = (field: string, fieldFacets: FilterFacets[string]) => {
		const searchTerm = searchTerms[field] || '';
		const filteredFacets = searchTerm
			? fieldFacets.filter((f) => f.value.toLowerCase().includes(searchTerm.toLowerCase()))
			: fieldFacets;

		const currentDisplayCount = displayCounts[field] || INITIAL_DISPLAY_LIMIT;
		const filteredAndLimitedFacets = filteredFacets.slice(0, currentDisplayCount);
		const hasMore = filteredFacets.length > currentDisplayCount;
		const remaining = filteredFacets.length - currentDisplayCount;

		return {
			filteredAndLimitedFacets,
			hasMore,
			remaining,
			searchTerm,
		};
	};

	const handleSearchChange = (field: string, value: string) => {
		setSearchTerms({ ...searchTerms, [field]: value });
	};

	const handleLoadMore = (field: string) => {
		const currentCount = displayCounts[field] || INITIAL_DISPLAY_LIMIT;
		setDisplayCounts({
			...displayCounts,
			[field]: currentCount + LOAD_MORE_INCREMENT,
		});
	};

	const shouldShowSearch = (fieldFacets: FilterFacets[string]) => {
		return fieldFacets.length > INITIAL_DISPLAY_LIMIT;
	};

	return {
		searchTerms,
		getFilteredAndLimitedFacets,
		handleSearchChange,
		handleLoadMore,
		shouldShowSearch,
	};
};
