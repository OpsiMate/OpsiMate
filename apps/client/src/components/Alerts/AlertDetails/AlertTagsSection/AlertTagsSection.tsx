import { Badge } from '@/components/ui/badge';
import { Alert } from '@OpsiMate/shared';
import { getAlertTagEntries } from '../../utils/alertTags.utils';

interface AlertTagsSectionProps {
	alert: Alert;
}

// The alert's labels (tags) as neutral badges; label colors are reserved for the
// alerts table columns. Moved out of the identity block to its own collapsible
// section lower in the panel.
export const AlertTagsSection = ({ alert }: AlertTagsSectionProps) => {
	return (
		<div className="flex items-center gap-1 flex-wrap">
			{getAlertTagEntries(alert).map(({ key, value }) => (
				<Badge
					key={key}
					variant="outline"
					className="max-w-full rounded-md text-xs font-normal text-muted-foreground"
				>
					{/* Single text-flow span so long values wrap inside the badge instead of
					    splitting key/colon/value into separate flex items. break-all handles
					    unbroken tokens like URLs and pod names. */}
					<span className="break-all">
						<span className="font-medium text-foreground">{key}</span>: {value}
					</span>
				</Badge>
			))}
		</div>
	);
};
