import { Separator } from '@/components/ui/separator';
import { Alert } from '@OpsiMate/shared';

interface AlertSummarySectionProps {
	summary: string;
}

export const AlertSummarySection = ({ summary }: AlertSummarySectionProps) => {
	return (
		<>
			<Separator />
			<div>
				<p className="text-sm text-foreground leading-relaxed">{summary}</p>
			</div>
		</>
	);
};
