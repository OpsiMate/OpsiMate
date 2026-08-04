import { useState } from 'react';

const STORAGE_KEY = 'opsimate-alerts-expand-rows';

// Page-level preference for wrapping cell content onto new lines (full name/summary/
// labels) instead of truncating, remembered across sessions like severity colors.
export const useExpandRows = () => {
	const [expandRows, setExpandRows] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

	const toggleExpandRows = () =>
		setExpandRows((prev) => {
			localStorage.setItem(STORAGE_KEY, String(!prev));
			return !prev;
		});

	return { expandRows, toggleExpandRows };
};
