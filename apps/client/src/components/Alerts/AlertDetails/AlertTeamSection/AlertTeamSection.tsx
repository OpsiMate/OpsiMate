import { Badge } from '@/components/ui/badge';
import { useOncallTeams } from '@/hooks/queries/oncall';
import { Phone } from 'lucide-react';
import { useMemo } from 'react';

interface AlertTeamSectionProps {
	// The alert's owning team name (matched case-insensitively against on-call teams).
	team: string;
}

// One compact line: the alert's owning team and who is on call for it right now
// (priority 1 of the matching on-call team), with a tel: link so the NOC can dial.
export const AlertTeamSection = ({ team }: AlertTeamSectionProps) => {
	const { data: teams = [] } = useOncallTeams();

	const oncallTeam = useMemo(
		() => teams.find((t) => t.name.toLowerCase() === team.toLowerCase()) ?? null,
		[teams, team]
	);
	const onCallNow = oncallTeam?.members.find((m) => m.priority === 1) ?? null;

	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
			<span className="font-medium">{team}</span>
			{onCallNow ? (
				<span
					data-testid="alert-team-oncall"
					title="On call now"
					className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs font-semibold"
				>
					<Badge variant="default" className="h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
						1
					</Badge>
					{onCallNow.fullName}
					{onCallNow.phoneNumber ? (
						<a
							href={`tel:${onCallNow.phoneNumber.replace(/[^+\d]/g, '')}`}
							onClick={(e) => e.stopPropagation()}
							className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
						>
							<Phone className="h-3 w-3" />
							{onCallNow.phoneNumber}
						</a>
					) : (
						<span className="font-normal text-muted-foreground">(no phone)</span>
					)}
				</span>
			) : (
				<span className="text-xs text-muted-foreground">no on-call schedule</span>
			)}
		</div>
	);
};
