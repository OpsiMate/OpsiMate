import { SeverityBadge } from '@/components/Alerts/SeverityBadge';
import { Badge } from '@/components/ui/badge';
import { IncidentSummary } from '@OpsiMate/shared';

interface IncidentRollupsProps {
	incident: IncidentSummary;
}

const BADGE_CLASSES = 'h-5 px-1.5 text-xs shrink-0';

// The roll-up badges an incident is summarized by — worst severity and the
// firing/silenced/resolved split — shared by the folder row and the details panel so a
// closed folder and an open panel tell the same story. Rendered as a fragment: each
// caller owns the flex container the badges sit in.
export const IncidentRollups = ({ incident }: IncidentRollupsProps) => (
	<>
		{incident.worstSeverity && <SeverityBadge severity={incident.worstSeverity} />}
		{incident.firingCount > 0 && (
			<Badge variant="destructive" className={BADGE_CLASSES}>
				{incident.firingCount} firing
			</Badge>
		)}
		{incident.silencedCount > 0 && (
			<Badge variant="secondary" className={BADGE_CLASSES}>
				{incident.silencedCount} silenced
			</Badge>
		)}
		{incident.resolvedCount > 0 && (
			<Badge variant="success" className={BADGE_CLASSES}>
				{incident.resolvedCount} resolved
			</Badge>
		)}
	</>
);
