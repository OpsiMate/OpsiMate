import { FormattedText } from '@/components/shared';
import { SUMMARY_MAX_HEIGHT_CLASS } from './AlertSummarySection.constants';

interface AlertSummarySectionProps {
	summary: string;
}

// Long summaries get most of the panel: the block is capped at ~60% of the viewport (the
// panel is full-height, so ~60% of the sidebar) and scrolls inside past that, so the
// sections below it stay reachable without scrolling the whole body. The cap can be this
// generous because links and actions no longer sit in the body — they are pinned under it.
export const AlertSummarySection = ({ summary }: AlertSummarySectionProps) => {
	return (
		<div className={`${SUMMARY_MAX_HEIGHT_CLASS} overflow-y-auto pr-1`}>
			<FormattedText text={summary} className="text-sm text-foreground leading-relaxed" />
		</div>
	);
};
