import { Badge } from '@/components/ui/badge';
import { Alert } from '@OpsiMate/shared';
import { getAlertTagEntries } from '../../utils/alertTags.utils';
import { getTagKeyColor } from '../../utils/tagColors.utils';

interface AlertTagsSectionProps {
	alert: Alert;
}

// The alert's labels (tags) as colored badges. Moved out of the identity block to its own
// collapsible section lower in the panel.
export const AlertTagsSection = ({ alert }: AlertTagsSectionProps) => {
	return (
		<div className="flex items-center gap-1 flex-wrap">
			{getAlertTagEntries(alert).map(({ key, value }) => {
				const colors = getTagKeyColor(key);
				return (
					<Badge
						key={key}
						className="text-xs border-0"
						style={{ backgroundColor: colors.background, color: colors.text }}
					>
						{key}: {value}
					</Badge>
				);
			})}
		</div>
	);
};
