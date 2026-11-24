import { ActionTypeIcon } from '@/components/Actions/ActionTypeIcon';
import { Button } from '@/components/ui/button';
import { useActions } from '@/hooks/queries/actions';
import { ROUTES } from '@/lib/routes';
import { Action, Alert, criteriaMatchesAlert } from '@OpsiMate/shared';
import { Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CollapsibleSection } from '../CollapsibleSection';
import { ActionSendDialog } from './ActionSendDialog';
import { ACTIONS_SECTION_TITLE, MANAGE_ACTIONS_LABEL } from './AlertActions.constants';

interface AlertActionsProps {
	alert: Alert;
}

// An action is offered on an alert when the shared matcher says so (see
// criteriaMatchesAlert in @OpsiMate/shared): name substrings OR together, label groups
// OR together, and the two AND. Unlike mute policies and enrichments, an action with NO
// criteria is offered everywhere — that is the "applies to all alerts" case.
const actionMatchesAlert = (action: Action, alert: Alert): boolean =>
	criteriaMatchesAlert(action, alert, { emptyCriteriaMatches: true });

// The custom-actions section: a CollapsibleSection like the others, so the header's
// expand/collapse-all controls fold it too. Open by default — it sits in the pinned
// block above the footer, where the buttons should be one click away.
export const AlertActions = ({ alert }: AlertActionsProps) => {
	const { data: allActions = [], isLoading } = useActions();
	const [selected, setSelected] = useState<Action | null>(null);

	const actions = allActions.filter((a) => actionMatchesAlert(a, alert));

	if (isLoading) return null;

	return (
		<CollapsibleSection
			title={ACTIONS_SECTION_TITLE}
			icon={<Zap className="h-3.5 w-3.5" />}
			defaultOpen
			badge={actions.length > 0 ? `(${actions.length})` : undefined}
			headerRight={
				<Link
					to={ROUTES.actions}
					className="text-xs text-muted-foreground hover:text-foreground hover:underline"
				>
					{MANAGE_ACTIONS_LABEL}
				</Link>
			}
		>
			{actions.length === 0 ? (
				allActions.length > 0 ? (
					<p className="text-xs text-muted-foreground">
						No actions apply to this alert.{' '}
						<Link to={ROUTES.actions} className="underline hover:text-foreground">
							Manage actions
						</Link>
					</p>
				) : (
					<p className="text-xs text-muted-foreground">
						No actions configured.{' '}
						<Link to={ROUTES.actions} className="underline hover:text-foreground">
							Create one
						</Link>{' '}
						to notify Slack, Teams, Jira, or call a webhook.
					</p>
				)
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
			)}

			<ActionSendDialog
				open={!!selected}
				onOpenChange={(open) => {
					if (!open) setSelected(null);
				}}
				action={selected}
				alert={alert}
			/>
		</CollapsibleSection>
	);
};
