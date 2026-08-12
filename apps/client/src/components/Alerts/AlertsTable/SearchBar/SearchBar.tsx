import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface SearchBarProps {
	searchTerm: string;
	onSearchChange: (searchTerm: string) => void;
}

// Search runs on the SERVER now (it always did — the term flows into the alerts query),
// so an un-debounced input fired a request per keystroke and dirtied the dashboard on
// every character. The input stays instant against local state; the term is pushed to the
// parent (and thus the server query) only after a short pause. An external change to
// searchTerm — a dashboard load or a reset — resyncs the field without echoing back.
const SEARCH_DEBOUNCE_MS = 300;

export const SearchBar = ({ searchTerm, onSearchChange }: SearchBarProps) => {
	const [value, setValue] = useState(searchTerm);

	// Read the latest callback through a ref so the debounce effect does NOT depend on it.
	// The parent passes a fresh closure every render, and a parent re-render (the 5s poll)
	// while a term is pending would otherwise clear and restart the timer — delaying the
	// search. Keyed only on value/searchTerm now, the timer survives unrelated re-renders.
	const onSearchChangeRef = useRef(onSearchChange);
	onSearchChangeRef.current = onSearchChange;

	useEffect(() => {
		setValue(searchTerm);
	}, [searchTerm]);

	useEffect(() => {
		if (value === searchTerm) return;
		const timer = setTimeout(() => onSearchChangeRef.current(value), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [value, searchTerm]);

	return (
		<div className="relative flex-1 max-w-sm">
			<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
			<Input
				placeholder="Search alerts..."
				value={value}
				onChange={(e) => setValue(e.target.value)}
				className="h-7 pl-7 pr-2 text-sm"
			/>
		</div>
	);
};
