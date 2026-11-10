import { Badge } from '@/components/ui/badge';
import { OncallTeamMember } from '@OpsiMate/shared';
import { Phone } from 'lucide-react';
import { NO_PHONE_TEXT, ON_CALL_NOW_TITLE } from '../AlertTeamSection.constants';

interface OnCallBadgeProps {
	member: OncallTeamMember;
}

// The person on call right now: priority pill, name, and a tel: link so the NOC can dial.
export const OnCallBadge = ({ member }: OnCallBadgeProps) => (
	<span
		data-testid="alert-team-oncall"
		title={ON_CALL_NOW_TITLE}
		className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs font-semibold"
	>
		<Badge variant="default" className="h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
			{member.priority}
		</Badge>
		{member.fullName}
		{member.phoneNumber ? (
			<a
				href={`tel:${member.phoneNumber.replace(/[^+\d]/g, '')}`}
				onClick={(e) => e.stopPropagation()}
				className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
			>
				<Phone className="h-3 w-3" />
				{member.phoneNumber}
			</a>
		) : (
			<span className="font-normal text-muted-foreground">{NO_PHONE_TEXT}</span>
		)}
	</span>
);
