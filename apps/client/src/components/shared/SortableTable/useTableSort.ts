import { useCallback, useMemo, useRef, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

// A column's sortable value. Returning null/undefined parks the row at the END in both
// directions: "no priority" or "no window" is absence, not a small value, and flipping
// direction shouldn't drag a blank row to the top.
export type SortValue = string | number | boolean | null | undefined;

// Key and direction live in ONE state value: they change together, and updating one
// from inside the other's updater would be an impure updater — React may invoke it more
// than once (it does in StrictMode), which double-toggles the direction back to where
// it started.
interface SortSelection<TKey extends string> {
	key: TKey | null;
	direction: SortDirection;
}

export interface TableSortState<TKey extends string> {
	sortKey: TKey | null;
	direction: SortDirection;
	toggle: (key: TKey) => void;
}

interface UseTableSortOptions<TKey extends string> {
	// Column the table starts sorted by, or null for the list's natural order.
	// NoInfer: TKey must come from the accessors map — inferring it here too would
	// narrow the whole map to the single key named in the options.
	initialKey?: NoInfer<TKey> | null;
	initialDirection?: SortDirection;
}

const compareValues = (a: SortValue, b: SortValue): number => {
	const aMissing = a === null || a === undefined || a === '';
	const bMissing = b === null || b === undefined || b === '';
	if (aMissing && bMissing) return 0;
	// Missing sorts last regardless of direction (see SortValue) — the caller's
	// direction flip is applied only to the comparison below.
	if (aMissing) return Number.POSITIVE_INFINITY;
	if (bMissing) return Number.NEGATIVE_INFINITY;
	if (typeof a === 'number' && typeof b === 'number') return a - b;
	if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
	// localeCompare, not <: rule names are human text, so "Éxpiry" must sort next to
	// "Expiry" rather than after "Zzz", and numeric:true keeps "policy 2" before
	// "policy 10".
	return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

// Click-to-sort state plus the sort itself, shared by the rule tables (mute policies,
// enrichments, actions). Same three-state header behaviour as the alerts table: first
// click sorts, second reverses; the row order is otherwise the list's own.
export const useTableSort = <TRow, TKey extends string>(
	rows: TRow[],
	accessors: Record<TKey, (row: TRow) => SortValue>,
	options: UseTableSortOptions<TKey> = {}
): TableSortState<TKey> & { sorted: TRow[] } => {
	const [sortKey, setSortKey] = useState<TKey | null>(options.initialKey ?? null);
	const [direction, setDirection] = useState<SortDirection>(options.initialDirection ?? 'asc');

	const toggle = useCallback((key: TKey) => {
		setSortKey((currentKey) => {
			if (currentKey === key) {
				setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
				return currentKey;
			}
			setDirection('asc');
			return key;
		});
	}, []);

	// Callers build the accessor map inline, so it has a new identity every render;
	// putting it in the memo's deps would defeat the memo entirely. A ref keeps the
	// CURRENT accessors available without making identity a recompute trigger.
	const accessorsRef = useRef(accessors);
	accessorsRef.current = accessors;

	const sorted = useMemo(() => {
		if (!sortKey) return rows;
		const accessor = accessorsRef.current[sortKey];
		if (!accessor) return rows;
		// Copy before sorting: the incoming array is the memoized filter result, and
		// sorting in place would mutate it (and reorder the caller's list on every
		// render).
		const factor = direction === 'asc' ? 1 : -1;
		return [...rows].sort((a, b) => {
			const result = compareValues(accessor(a), accessor(b));
			// Absent values already resolved to ±Infinity, which must NOT be flipped by
			// direction — they always sink to the bottom.
			if (!Number.isFinite(result)) return result === Number.POSITIVE_INFINITY ? 1 : -1;
			return result * factor;
		});
	}, [rows, sortKey, direction]);

	return { sortKey, direction, toggle, sorted };
};
