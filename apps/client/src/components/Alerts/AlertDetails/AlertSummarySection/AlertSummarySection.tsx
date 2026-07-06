import { FormattedText } from '@/components/shared';

interface AlertSummarySectionProps {
	summary: string;
}

// Long summaries scroll inside the section instead of pushing the rest of the details
// panel down: the block is capped at ~30% of the viewport (the panel is full-height, so
// this is ~30% of the sidebar) and overflows vertically.
export const AlertSummarySection = ({ summary }: AlertSummarySectionProps) => {
	return (
		<div className="max-h-[30vh] overflow-y-auto pr-1">
			<FormattedText text={summary} className="text-sm text-foreground leading-relaxed" />
		</div>
	);
};
