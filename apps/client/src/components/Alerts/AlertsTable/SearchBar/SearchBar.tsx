import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
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

	// A non-empty term restyles the field (accent border + tint) and adds an inline
	// clear button — users forget an active search and wonder where their alerts went,
	// so the field itself must read as "filtering right now", not just "a search box".
	const isActive = value.trim().length > 0;

	const clearSearch = () => {
		setValue('');
		// Immediate, not debounced: clearing should restore the full list right away.
		onSearchChangeRef.current('');
	};

	return (
		<div className="relative flex-1 max-w-sm">
			<Search
				className={cn(
					'absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3',
					isActive ? 'text-primary' : 'text-muted-foreground'
				)}
			/>
			<Input
				placeholder="Search alerts..."
				value={value}
				onChange={(e) => setValue(e.target.value)}
				className={cn(
					'h-7 pl-7 text-sm',
					isActive ? 'pr-7 border-primary/60 bg-primary/5 focus-visible:ring-primary/40' : 'pr-2'
				)}
			/>
			{isActive && (
				<button
					type="button"
					onClick={clearSearch}
					aria-label="Clear search"
					title="Clear search"
					className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			)}
		</div>
	);
};
