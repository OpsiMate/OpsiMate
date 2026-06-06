import { cn } from '@/lib/utils';
import { ActionType } from '@OpsiMate/shared';
import { Globe } from 'lucide-react';

// Brand logos for action types, served from public/images/logos. HTTP has no brand logo
// and falls back to a generic globe icon.
export const ACTION_LOGO_SRC: Partial<Record<ActionType, string>> = {
	slack: 'images/logos/slack.svg',
	teams: 'images/logos/teams.svg',
	jira: 'images/logos/jira.svg',
};

interface ActionTypeIconProps {
	type: ActionType;
	className?: string;
}

export const ActionTypeIcon = ({ type, className }: ActionTypeIconProps) => {
	const cls = className ?? 'h-4 w-4';
	const src = ACTION_LOGO_SRC[type];
	if (src) {
		return <img src={src} alt={type} className={cn(cls, 'object-contain flex-shrink-0')} />;
	}
	return <Globe className={cn(cls, 'flex-shrink-0 text-muted-foreground')} />;
};
