import { useState } from 'react';

const STORAGE_KEY = 'opsimate-alerts-filter-panel-collapsed';

// Page-level preference for the alerts filter sidebar, remembered across sessions like
// expandRows. Collapsed is the default — most sessions start from a saved view rather
// than from building filters, so the table gets the width until someone asks for the
// panel. Only an explicit 'false' expands it, so a missing or corrupt value collapses.
//
// Written on toggle rather than in an effect, so "never chose" stays distinguishable
// from "chose collapsed" and the default remains changeable later.
export const useFilterPanelCollapsed = () => {
	const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(
		() => localStorage.getItem(STORAGE_KEY) !== 'false'
	);

	const toggleFilterPanelCollapsed = () =>
		setFilterPanelCollapsed((prev) => {
			localStorage.setItem(STORAGE_KEY, String(!prev));
			return !prev;
		});

	return { filterPanelCollapsed, toggleFilterPanelCollapsed };
};
