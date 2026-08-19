import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { ReactNode } from 'react';
import { SortDirection } from './useTableSort';

interface SortableTableHeadProps<TKey extends string> {
	// The column this header sorts by; also what `toggle` receives.
	sortKey: TKey;
	activeKey: TKey | null;
	direction: SortDirection;
	onToggle: (key: TKey) => void;
	children: ReactNode;
	className?: string;
}

// A clickable column header for the rule tables. Mirrors the alerts table's affordance
// on purpose — a neutral up/down glyph when idle, a single arrow showing the direction
// when active — so sorting looks the same everywhere in the product. Rendered as a
// native button inside the cell so it is focusable and operable by keyboard, which a
// click handler on the <th> alone would not be.
export const SortableTableHead = <TKey extends string>({
	sortKey,
	activeKey,
	direction,
	onToggle,
	children,
	className,
}: SortableTableHeadProps<TKey>) => {
	const isActive = activeKey === sortKey;
	return (
		<TableHead
			className={className}
			aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
		>
			<button
				type="button"
				onClick={() => onToggle(sortKey)}
				className="group -mx-1 flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
			>
				{children}
				{isActive ? (
					direction === 'asc' ? (
						<ArrowUp className="h-3 w-3 shrink-0" />
					) : (
						<ArrowDown className="h-3 w-3 shrink-0" />
					)
				) : (
					// Held at low opacity rather than hidden: a header that grows an icon
					// only on hover doesn't advertise that the table sorts at all.
					<ArrowUpDown className={cn('h-3 w-3 shrink-0 opacity-40 group-hover:opacity-100')} />
				)}
			</button>
		</TableHead>
	);
};
