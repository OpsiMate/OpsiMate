import { useEffect } from 'react';
import { AlertTab } from '../AlertsTable/AlertsTable.types';

interface UseResolvedTabStatusFilterResetOptions {
	activeTab: AlertTab;
	filters: Record<string, string[]>;
	onFilterChange: (filters: Record<string, string[]>) => void;
}

export const useResolvedTabStatusFilterReset = ({
	activeTab,
	filters,
	onFilterChange,
}: UseResolvedTabStatusFilterResetOptions) => {
	useEffect(() => {
		if (activeTab === AlertTab.Resolved) {
			if (filters.status && filters.status.length > 0) {
				const updatedFilters = { ...filters };
				delete updatedFilters.status;
				onFilterChange(updatedFilters);
			}
		}
	}, [activeTab]);
};
