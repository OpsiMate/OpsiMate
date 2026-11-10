import { FormattedText } from '@/components/shared';
import { ScrollHintBox } from '../ScrollHintBox';
import { SUMMARY_MIN_HEIGHT_CLASS } from './AlertSummarySection.constants';

interface AlertSummarySectionProps {
	summary: string;
}

// The summary takes whatever height its column gives it: most of the panel when it is
// alone, a share of it next to a root cause or a comment. Past that it scrolls inside,
// with a "scroll for more" hint (ScrollHintBox).
export const AlertSummarySection = ({ summary }: AlertSummarySectionProps) => (
	<ScrollHintBox contentKey={summary} floorClassName={SUMMARY_MIN_HEIGHT_CLASS}>
		<FormattedText text={summary} className="text-sm text-foreground leading-relaxed" />
	</ScrollHintBox>
);
