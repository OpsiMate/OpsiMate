import { Separator } from '@/components/ui/separator';
import { Alert } from '@OpsiMate/shared';
import { format } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';

interface AlertTimestampsSectionProps {
	alert: Alert;
}

export const AlertTimestampsSection = ({ alert }: AlertTimestampsSectionProps) => {
	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return isNaN(date.getTime()) ? 'Invalid Date' : format(date, 'PPpp');
	};

	return (
		<>
			<Separator />
			<div className="space-y-3">
				<div className="flex items-start gap-3">
					<Calendar className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
					<div className="flex-1 min-w-0">
						<div className="text-xs font-medium text-foreground mb-1">Started At</div>
						<div className="text-sm text-foreground">{formatDate(alert.startsAt)}</div>
					</div>
				</div>

				{alert.updatedAt && (
					<div className="flex items-start gap-3">
						<Clock className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
						<div className="flex-1 min-w-0">
							<div className="text-xs font-medium text-foreground mb-1">Last Updated</div>
							<div className="text-sm text-foreground">{formatDate(alert.updatedAt)}</div>
						</div>
					</div>
				)}
			</div>
		</>
	);
};
