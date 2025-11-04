import { ActionTarget, ActionType } from '@OpsiMate/custom-actions';
import { Globe, LucideIcon, Terminal } from 'lucide-react';

export const ACTION_TARGET_COLORS: Record<ActionTarget, string> = {
	service: 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20',
	provider: 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20',
	null: 'bg-gray-500/10 border-gray-500/20 hover:bg-gray-500/20',
};

export const ACTION_TARGET_LABELS: Record<ActionTarget, string> = {
	service: 'Service Actions',
	provider: 'Provider Actions',
};

export const ACTION_TYPE_ICONS: Record<ActionType, LucideIcon> = {
	bash: Terminal,
	http: Globe,
};
