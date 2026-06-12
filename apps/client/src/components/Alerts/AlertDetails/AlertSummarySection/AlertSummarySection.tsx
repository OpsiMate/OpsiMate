import { FormattedText } from '@/components/shared';
import { Separator } from '@/components/ui/separator';

interface AlertSummarySectionProps {
	summary: string;
}

export const AlertSummarySection = ({ summary }: AlertSummarySectionProps) => {
	return (
		<>
			<Separator />
			<div>
				<FormattedText text={summary} className="text-sm text-foreground leading-relaxed" />
			</div>
		</>
	);
};
