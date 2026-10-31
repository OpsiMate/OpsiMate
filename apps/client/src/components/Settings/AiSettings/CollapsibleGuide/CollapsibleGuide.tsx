import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface CollapsibleGuideProps {
	icon: LucideIcon;
	iconClassName?: string;
	title: string;
	// One line under the title, read while the guide is folded.
	tagline: string;
	// Deep-link anchor (/settings#mcp).
	id?: string;
	defaultOpen?: boolean;
	children: ReactNode;
}

// A how-to section of the AI tab, folded by default: the title and one line say what it
// is, the body opens on demand. Native <details>, so it needs no state and the content is
// in the DOM for find-in-page.
export const CollapsibleGuide = ({
	icon: Icon,
	iconClassName,
	title,
	tagline,
	id,
	defaultOpen = false,
	children,
}: CollapsibleGuideProps) => (
	<details id={id} className="group/guide min-w-0 max-w-4xl" open={defaultOpen}>
		<summary className="flex cursor-pointer list-none items-start gap-2 rounded-md py-1 [&::-webkit-details-marker]:hidden">
			<ChevronRight
				className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/guide:rotate-90"
				aria-hidden
			/>
			<Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconClassName)} aria-hidden />
			<span className="min-w-0">
				<h2 className="text-lg font-semibold text-foreground leading-6">{title}</h2>
				<p className="text-sm text-muted-foreground">{tagline}</p>
			</span>
		</summary>
		<Card className="mt-3 p-4 space-y-5">{children}</Card>
	</details>
);
