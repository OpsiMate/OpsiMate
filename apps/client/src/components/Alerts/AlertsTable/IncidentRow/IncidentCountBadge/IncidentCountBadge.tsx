import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { IncidentSummary } from '@OpsiMate/shared';
import {
	GROUP_COUNT_BADGE_CLASSES,
	GROUP_STATUS_BADGE_CLASS,
	GROUP_STATUS_BADGE_VARIANT,
} from '../../AlertsTable.constants';
import { incidentStatus, incidentStatusBreakdown } from '../IncidentRow.utils';

interface IncidentCountBadgeProps {
	incident: IncidentSummary;
	// Members passing the current filters; shown as "shown/total" when fewer than all.
	shownCount: number;
}

// The folder's count, coloured by the incident's rolled-up status — the same badge a
// group header opens with, so folders and groups read alike. Hover for the split.
export const IncidentCountBadge = ({ incident, shownCount }: IncidentCountBadgeProps) => {
	const status = incidentStatus(incident);
	const breakdown = incidentStatusBreakdown(incident);
	const partial = shownCount < incident.alertCount;
	return (
		<Badge
			variant={GROUP_STATUS_BADGE_VARIANT[status]}
			className={cn(GROUP_COUNT_BADGE_CLASSES, GROUP_STATUS_BADGE_CLASS[status])}
			title={breakdown}
			aria-label={breakdown}
		>
			{partial ? `${shownCount}/${incident.alertCount}` : incident.alertCount}
		</Badge>
	);
};
