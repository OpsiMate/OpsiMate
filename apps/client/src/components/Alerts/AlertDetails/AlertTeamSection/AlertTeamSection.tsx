import { Badge } from '@/components/ui/badge';
import { useOncallTeams } from '@/hooks/queries/oncall';
import { Phone } from 'lucide-react';
import { useMemo } from 'react';

interface AlertTeamSectionProps {
	// The alert's owning team name (matched case-insensitively against on-call teams).
	team: string;
}

// Shows the alert's owning team and who is on call for it right now (priority 1 of the
// matching on-call team), with their phone number so the NOC can reach them directly.
export const AlertTeamSection = ({ team }: AlertTeamSectionProps) => {
	const { data: teams = [] } = useOncallTeams();

	const oncallTeam = useMemo(
		() => teams.find((t) => t.name.toLowerCase() === team.toLowerCase()) ?? null,
		[teams, team]
	);
	const onCallNow = oncallTeam?.members.find((m) => m.priority === 1) ?? null;

	return (
		<div className="space-y-2 text-sm">
			<div className="flex items-center gap-2">
				<span className="text-muted-foreground">Team</span>
				<span className="font-medium">{team}</span>
			</div>
			{onCallNow ? (
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-muted-foreground">On call now</span>
					<span
						data-testid="alert-team-oncall"
						className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs font-semibold"
					>
						<Badge variant="default" className="h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
							1
						</Badge>
						{onCallNow.fullName}
						{onCallNow.phoneNumber && (
							<a
								href={`tel:${onCallNow.phoneNumber.replace(/[^+\d]/g, '')}`}
								onClick={(e) => e.stopPropagation()}
								className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
							>
								<Phone className="h-3 w-3" />
								{onCallNow.phoneNumber}
							</a>
						)}
					</span>
					{onCallNow && !onCallNow.phoneNumber && (
						<span className="text-xs text-muted-foreground">(no phone number set)</span>
					)}
				</div>
			) : (
				<div className="text-xs text-muted-foreground">No on-call schedule configured for this team.</div>
			)}
		</div>
	);
};
