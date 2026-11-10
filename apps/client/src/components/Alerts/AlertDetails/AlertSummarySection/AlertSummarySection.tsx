import { FormattedText } from '@/components/shared';
import { ChevronDown } from 'lucide-react';
import { useRef } from 'react';
import { useScrollOverflowHint } from '../hooks';
import { SCROLL_HINT_LABEL, SCROLL_HINT_TEST_ID, SUMMARY_MAX_HEIGHT_CLASS } from './AlertSummarySection.constants';

interface AlertSummarySectionProps {
	summary: string;
}

// Long summaries scroll inside the section past ~42% of the viewport (the panel is
// full-height, so ~42% of the sidebar) — enough for a few paragraphs while the sections
// below stay in view. While there is text below the fold, a fade with a chevron says so;
// it goes away at the bottom.
export const AlertSummarySection = ({ summary }: AlertSummarySectionProps) => {
	const scrollRef = useRef<HTMLDivElement>(null);
	const hasMoreBelow = useScrollOverflowHint(scrollRef, [summary]);
	return (
		<div className="relative">
			<div ref={scrollRef} className={`${SUMMARY_MAX_HEIGHT_CLASS} overflow-y-auto pr-1`}>
				<FormattedText text={summary} className="text-sm text-foreground leading-relaxed" />
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
