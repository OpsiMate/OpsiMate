import { ActionTypeIcon } from '@/components/Actions/ActionTypeIcon';
import { Button } from '@/components/ui/button';
import { useActions } from '@/hooks/queries/actions';
import { Action, Alert, criteriaMatchesAlert } from '@OpsiMate/shared';
import { ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ActionSendDialog } from './ActionSendDialog';

interface AlertActionsProps {
	alert: Alert;
}

// An action shows on an alert when it has no filter, or when its filter matches:
// An action is offered on an alert when the shared matcher says so (see
// criteriaMatchesAlert in @OpsiMate/shared): name substrings OR together, label groups
// OR together, and the two AND. Unlike mute policies and enrichments, an action with NO
// criteria is offered everywhere — that is the "applies to all alerts" case.
const actionMatchesAlert = (action: Action, alert: Alert): boolean =>
	criteriaMatchesAlert(action, alert, { emptyCriteriaMatches: true });

export const AlertActions = ({ alert }: AlertActionsProps) => {
	const { data: allActions = [], isLoading } = useActions();
	const [selected, setSelected] = useState<Action | null>(null);
	const [expanded, setExpanded] = useState(false);

	const actions = allActions.filter((a) => actionMatchesAlert(a, alert));

	if (isLoading) return null;

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
					aria-expanded={expanded}
				>
					{expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
					<Zap className="h-3.5 w-3.5" />
					<h3 className="text-xs font-semibold uppercase tracking-wide">Actions</h3>
					{actions.length > 0 && (
						<span className="text-xs font-normal normal-case text-muted-foreground">
							({actions.length})
						</span>
					)}
				</button>
				{expanded && (
					<Link to="/actions" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
						Manage
					</Link>
				)}
			</div>

			{expanded &&
				(actions.length === 0 ? (
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
								<ActionTypeIcon type={action.type} />
								<span className="max-w-[140px] truncate">{action.name}</span>
							</Button>
						))}
					</div>
				))}

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
