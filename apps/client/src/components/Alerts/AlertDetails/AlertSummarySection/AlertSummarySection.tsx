import { FormattedText } from '@/components/shared';

interface AlertSummarySectionProps {
	summary: string;
}

export const AlertSummarySection = ({ summary }: AlertSummarySectionProps) => {
	return <FormattedText text={summary} className="text-sm text-foreground leading-relaxed" />;
};
