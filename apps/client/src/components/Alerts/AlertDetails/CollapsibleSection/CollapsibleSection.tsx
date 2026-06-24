import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ReactNode, useState } from 'react';

interface CollapsibleSectionProps {
	title: string;
	icon?: ReactNode;
	defaultOpen?: boolean;
	// Small adornment shown next to the title (e.g. a count).
	badge?: ReactNode;
	// Controls rendered on the right of the header; clicks here don't toggle the section.
	headerRight?: ReactNode;
	children: ReactNode;
	className?: string;
}

// A titled, collapsible block used to build the Alert Details panel. Each section shows a
// chevron + icon + uppercase title, an optional count badge, and optional right-side controls
// that don't toggle the section.
export const CollapsibleSection = ({
	title,
	icon,
	defaultOpen = true,
	badge,
	headerRight,
	children,
	className,
}: CollapsibleSectionProps) => {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<div className={cn('border-t border-border pt-2', className)}>
			<div className="flex items-center justify-between gap-2">
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					aria-expanded={open}
					className="flex items-center gap-1.5 min-w-0 flex-1 text-muted-foreground hover:text-foreground transition-colors"
				>
					{open ? (
						<ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
					) : (
						<ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
					)}
					{icon && <span className="flex-shrink-0">{icon}</span>}
					<h3 className="text-xs font-semibold uppercase tracking-wide truncate">{title}</h3>
					{badge != null && (
						<span className="text-xs font-normal normal-case text-muted-foreground">{badge}</span>
					)}
				</button>
				{headerRight && <div className="flex-shrink-0">{headerRight}</div>}
			</div>
			{open && <div className="mt-2">{children}</div>}
		</div>
	);
};
