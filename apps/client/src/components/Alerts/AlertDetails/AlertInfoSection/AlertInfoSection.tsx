import { PersonPicker } from '@/components/PersonPicker';
import { useSetAlertOwner } from '@/hooks/queries/alerts';
import { useUsers } from '@/hooks/queries/users';
import { Alert } from '@OpsiMate/shared';
import { Sparkles } from 'lucide-react';
import { IntegrationAvatar, resolveAlertIntegration } from '../../IntegrationAvatar';
import { SeverityBadge } from '../../SeverityBadge';
import { StatusBadge } from '../../StatusBadge';
import { getAlertSeverity } from '../../utils/severity.utils';

interface AlertInfoSectionProps {
	alert: Alert;
}

export const AlertInfoSection = ({ alert }: AlertInfoSectionProps) => {
	const integration = resolveAlertIntegration(alert);
	const { data: users = [] } = useUsers();
	const { mutate: setOwner } = useSetAlertOwner();

	const handleOwnerChange = (userId: string | null) => {
		setOwner({ alertId: alert.id, ownerId: userId });
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<div className="flex-shrink-0">
					<IntegrationAvatar
						integration={integration}
						size="md"
						className="ring-2 ring-background shadow-sm"
					/>
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="text-lg font-semibold break-words min-w-0 text-foreground">{alert.alertName}</h3>
				</div>
			</div>
			<div className="flex items-center gap-2 flex-wrap">
				<span className="text-sm text-muted-foreground">Owner:</span>
				<PersonPicker selectedUserId={alert.ownerId} onSelect={handleOwnerChange} users={users} />
				{/* Icon-only indicators (severity, status, enriched) — labels live in tooltips
				    so the owner row stays compact even in a narrow panel. */}
				<div className="ml-auto flex items-center gap-2">
					<SeverityBadge severity={getAlertSeverity(alert)} />
					<StatusBadge alert={alert} />
					{alert.appliedEnrichments && alert.appliedEnrichments.length > 0 && (
						<span
							className="flex-shrink-0 text-violet-500"
							title={`Enriched by: ${alert.appliedEnrichments.map((e) => e.name).join(', ')}`}
						>
							<Sparkles className="h-3.5 w-3.5" aria-label="Enriched" />
						</span>
					)}
				</div>
			</div>
		</div>
	);
};
