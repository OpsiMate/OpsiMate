import { useState } from 'react';

const STORAGE_KEY = 'opsimate-alerts-severity-colors';

// Page-level preference for tinting alert rows by severity, remembered across sessions.
export const useSeverityColors = () => {
	const [severityColors, setSeverityColors] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

	const toggleSeverityColors = () =>
		setSeverityColors((prev) => {
			localStorage.setItem(STORAGE_KEY, String(!prev));
			return !prev;
		});

	return { severityColors, toggleSeverityColors };
};
