import { Button } from '@/components/ui/button';
import { useActions } from '@/hooks/queries/actions';
import { Action, ActionType, Alert } from '@OpsiMate/shared';
import { Globe, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ActionSendDialog } from './ActionSendDialog';

interface AlertActionsProps {
	alert: Alert;
}

const LOGO_SRC: Partial<Record<ActionType, string>> = {
	slack: 'images/logos/slack.svg',
	teams: 'images/logos/teams.svg',
	jira: 'images/logos/jira.svg',
};

const ActionIcon = ({ type }: { type: ActionType }) => {
	const src = LOGO_SRC[type];
	if (src) {
		return <img src={src} alt={type} className="h-4 w-4 object-contain flex-shrink-0" />;
	}
	// HTTP / fallback
	return <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
};

export const AlertActions = ({ alert }: AlertActionsProps) => {
	const { data: actions = [], isLoading } = useActions();
	const [selected, setSelected] = useState<Action | null>(null);

	if (isLoading) return null;

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<Zap className="h-3.5 w-3.5 text-muted-foreground" />
					<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</h3>
				</div>
				<Link to="/actions" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
					Manage
				</Link>
			</div>

			{actions.length === 0 ? (
				<p className="text-xs text-muted-foreground">
					No actions configured.{' '}
					<Link to="/actions" className="underline hover:text-foreground">
						Create one
					</Link>{' '}
					to notify Slack, Teams, Jira, or call a webhook.
				</p>
			) : (
				<div className="flex flex-wrap gap-2">
					{actions.map((action) => (
						<Button
							key={action.id}
							variant="outline"
							size="sm"
							className="gap-2"
							onClick={() => setSelected(action)}
							title={`Preview and send "${action.name}" for this alert`}
						>
							<ActionIcon type={action.type} />
							<span className="max-w-[140px] truncate">{action.name}</span>
						</Button>
					))}
				</div>
			)}

			<ActionSendDialog
				open={!!selected}
				onOpenChange={(open) => {
					if (!open) setSelected(null);
				}}
				action={selected}
				alert={alert}
			/>
		</div>
	);
};
