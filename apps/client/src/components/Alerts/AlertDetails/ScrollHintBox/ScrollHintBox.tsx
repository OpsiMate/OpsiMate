import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { ReactNode, useRef } from 'react';
import { useScrollOverflowHint } from '../hooks';
import { SCROLL_HINT_LABEL, SCROLL_HINT_TEST_ID } from './ScrollHintBox.constants';

interface ScrollHintBoxProps {
	children: ReactNode;
	// Re-measure when this changes (the text the box shows).
	contentKey?: unknown;
	// A floor (min-h-*) the box keeps when its column is crowded — applied only while the
	// content overflows, so short content stays its natural height.
	floorClassName?: string;
	className?: string;
}

// A block that fills what its flex column gives it and scrolls inside past that. While
// there is content below the fold, a fade with a chevron and "Scroll for more" sits at
// the bottom edge; it goes away at the bottom. Without it a capped block reads as if the
// text simply ended.
export const ScrollHintBox = ({ children, contentKey, floorClassName, className }: ScrollHintBoxProps) => {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { overflowing, hasMoreBelow } = useScrollOverflowHint(scrollRef, [contentKey]);
	return (
		<div className={cn('relative flex min-h-0 flex-1 flex-col', overflowing && floorClassName, className)}>
			<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
				{children}
			</div>
			{hasMoreBelow && (
				<div
					data-testid={SCROLL_HINT_TEST_ID}
					aria-hidden
					className="pointer-events-none absolute inset-x-0 bottom-0 flex h-12 items-end justify-center bg-linear-to-t from-background via-background/80 to-transparent pb-0.5"
				>
					<span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
						<ChevronDown className="h-3 w-3" />
						{SCROLL_HINT_LABEL}
					</span>
				</div>
			)}
		</div>
	);
};
