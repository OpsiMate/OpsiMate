import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';
import { AlertTeamSection } from '../AlertTeamSection';
import {
	TEAM_CHIP_TEST_ID,
	TEAM_CHIP_TOOLTIP,
	TEAM_POPOVER_ARIA_LABEL,
	teamTriggerAriaLabel,
} from './AlertTeamPopover.constants';

interface AlertTeamPopoverProps {
	// The alert's owning team name.
	team: string;
	// Sets the alert's owner (the "Assign to on-call" shortcut); omitted where owners
	// cannot be changed.
	onAssignOwner?: (userId: string) => void;
}

// The owning team stays out of the way until asked for, like the labels: a chip with the
// team name sits in the owner row, and clicking it opens who is on call right now (with a
// number to dial) and a one-click "Assign to on-call". It replaces the Team section the
// Details tab used to spend a row on.
export const AlertTeamPopover = ({ team, onAssignOwner }: AlertTeamPopoverProps) => (
	<Popover>
		<Tooltip>
			<TooltipTrigger asChild>
				<PopoverTrigger asChild>
					<button
						type="button"
						aria-label={teamTriggerAriaLabel(team)}
						data-testid={TEAM_CHIP_TEST_ID}
						className="inline-flex max-w-40 shrink-0 items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
					>
						<Users className="h-3 w-3 shrink-0" aria-hidden />
						<span className="truncate">{team}</span>
					</button>
				</PopoverTrigger>
			</TooltipTrigger>
			<TooltipContent>{TEAM_CHIP_TOOLTIP}</TooltipContent>
		</Tooltip>
		<PopoverContent align="start" aria-label={TEAM_POPOVER_ARIA_LABEL} className="w-80 max-w-[90vw] p-3">
			<AlertTeamSection team={team} onAssignOnCall={onAssignOwner} />
		</PopoverContent>
	</Popover>
);
