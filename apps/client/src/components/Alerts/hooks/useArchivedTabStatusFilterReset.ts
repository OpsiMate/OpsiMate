import { useEffect } from 'react';
import { AlertTab } from '../AlertsTable/AlertsTable.types';

interface UseArchivedTabStatusFilterResetOptions {
	activeTab: AlertTab;
	filters: Record<string, string[]>;
	onFilterChange: (filters: Record<string, string[]>) => void;
}

export const useArchivedTabStatusFilterReset = ({
	activeTab,
	filters,
	onFilterChange,
}: UseArchivedTabStatusFilterResetOptions) => {
	useEffect(() => {
		if (activeTab === AlertTab.Archived) {
			if (filters.status && filters.status.length > 0) {
				const updatedFilters = { ...filters };
				delete updatedFilters.status;
				onFilterChange(updatedFilters);
			}
		}
	}, [activeTab]);
};
