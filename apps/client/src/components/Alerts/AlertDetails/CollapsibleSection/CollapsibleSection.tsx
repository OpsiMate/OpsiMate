import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { SectionsExpandContext } from './SectionsExpandContext';

interface CollapsibleSectionProps {
	title: string;
	icon?: ReactNode;
	defaultOpen?: boolean;
	// Small adornment shown next to the title (e.g. a count).
	badge?: ReactNode;
	// Controls rendered on the right of the header; clicks here don't toggle the section.
	headerRight?: ReactNode;
	// Overrides the header's text colors (cn/twMerge resolves the conflict), letting a
	// section brand its title row — e.g. the AI-family violet on Root cause.
	headerClassName?: string;
	children: ReactNode;
	className?: string;
	// In a flex column: the section takes its content's height while there is room and
	// shrinks with its siblings when there is not (its content then scrolls), so a long
	// summary gets the whole panel when alone and a fair share next to a root cause.
	// It never grows past its content (that would leave gaps between sections). Folded,
	// it is just its header.
	fill?: boolean;
}

// Content-sized, shrinkable column item while open; a fixed header while folded.
const fillClasses = (open: boolean): string => (open ? 'flex min-h-0 flex-col flex-[0_1_auto]' : 'shrink-0');
const contentClasses = (fill: boolean): string => (fill ? 'mt-2 flex min-h-0 flex-1 flex-col' : 'mt-2');

// A titled, collapsible block used to build the Alert Details panel. Each section shows a
// chevron + icon + uppercase title, an optional count badge, and optional right-side controls
// that don't toggle the section.
export const CollapsibleSection = ({
	title,
	icon,
	defaultOpen = true,
	badge,
	headerRight,
	headerClassName,
	children,
	className,
	fill = false,
}: CollapsibleSectionProps) => {
	const [open, setOpen] = useState(defaultOpen);

	// Follow "Expand all" / "Collapse all" broadcasts, but only ones fired after this
	// section mounted — a late-mounting section keeps its defaultOpen.
	const signal = useContext(SectionsExpandContext);
	const lastToken = useRef(signal?.token);
	useEffect(() => {
		if (signal && signal.token !== lastToken.current) {
			lastToken.current = signal.token;
			setOpen(signal.open);
		}
	}, [signal]);

	return (
		<div className={cn('border-t border-border pt-2', fill && fillClasses(open), className)}>
			<div className="flex items-center justify-between gap-2">
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					aria-expanded={open}
					className={cn(
						'flex items-center gap-1.5 min-w-0 flex-1 text-muted-foreground hover:text-foreground transition-colors',
						headerClassName
					)}
				>
					{open ? (
						<ChevronDown className="h-3.5 w-3.5 shrink-0" />
					) : (
						<ChevronRight className="h-3.5 w-3.5 shrink-0" />
					)}
					{icon && <span className="shrink-0">{icon}</span>}
					<h3 className="text-xs font-semibold uppercase tracking-wide truncate">{title}</h3>
					{badge != null && (
						<span className="text-xs font-normal normal-case text-muted-foreground">{badge}</span>
					)}
				</button>
				{headerRight && <div className="shrink-0">{headerRight}</div>}
			</div>
			{open && <div className={contentClasses(fill)}>{children}</div>}
		</div>
	);
};
