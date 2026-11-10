import { Button } from '@/components/ui/button';
import { useOncallTeams } from '@/hooks/queries/oncall';
import { UserCheck } from 'lucide-react';
import { useMemo } from 'react';
import { ASSIGN_ON_CALL_LABEL, NO_SCHEDULE_TEXT, ON_CALL_PRIORITY } from './AlertTeamSection.constants';
import { OnCallBadge } from './OnCallBadge';

interface AlertTeamSectionProps {
	// The alert's owning team name (matched case-insensitively against on-call teams).
	team: string;
	// Offered when there is someone on call: make them the alert's owner.
	onAssignOnCall?: (userId: string) => void;
}

// The alert's owning team and who is on call for it right now (priority 1 of the
// matching on-call team), with a tel: link so the NOC can dial — and, when the caller
// allows it, one click to make that person the owner. Shown in the owner row's team
// popover (AlertTeamPopover).
export const AlertTeamSection = ({ team, onAssignOnCall }: AlertTeamSectionProps) => {
	const { data: teams = [] } = useOncallTeams();

	const oncallTeam = useMemo(
		() => teams.find((t) => t.name.toLowerCase() === team.toLowerCase()) ?? null,
		[teams, team]
	);
	const onCallNow = oncallTeam?.members.find((m) => m.priority === ON_CALL_PRIORITY) ?? null;

	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
			<span className="font-medium">{team}</span>
			{onCallNow ? (
				<OnCallBadge member={onCallNow} />
			) : (
				<span className="text-xs text-muted-foreground">{NO_SCHEDULE_TEXT}</span>
			)}
			{onCallNow && onAssignOnCall && (
				<Button
					variant="outline"
					size="sm"
					className="h-7 gap-1.5 text-xs"
					onClick={() => onAssignOnCall(onCallNow.userId)}
				>
					<UserCheck className="h-3.5 w-3.5" />
					{ASSIGN_ON_CALL_LABEL}
				</Button>
			)}
		</div>
	);
};
