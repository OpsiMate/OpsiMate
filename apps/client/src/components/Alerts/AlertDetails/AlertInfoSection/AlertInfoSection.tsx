import { PersonPicker } from '@/components/PersonPicker';
import { Badge } from '@/components/ui/badge';
import { useSetAlertOwner } from '@/hooks/queries/alerts';
import { useUsers } from '@/hooks/queries/users';
import { Alert, AlertStatus } from '@OpsiMate/shared';
import { Sparkles } from 'lucide-react';
import { IntegrationAvatar, resolveAlertIntegration } from '../../IntegrationAvatar';
import { SeverityBadge } from '../../SeverityBadge';
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
				<div className="ml-auto flex items-center gap-2">
					<SeverityBadge severity={getAlertSeverity(alert)} showLabel />
					<Badge
						variant={
							alert.isDismissed
								? 'secondary'
								: alert.status === AlertStatus.FIRING
									? 'destructive'
									: 'secondary'
						}
						className="flex-shrink-0 text-xs px-1.5 py-0.5"
					>
						{alert.isDismissed ? 'dismissed' : alert.status}
					</Badge>
					{alert.appliedEnrichments && alert.appliedEnrichments.length > 0 && (
						<Badge
							variant="secondary"
							className="flex-shrink-0 gap-1 text-xs px-1.5 py-0.5 bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30"
							title={`Enriched by: ${alert.appliedEnrichments.map((e) => e.name).join(', ')}`}
						>
							<Sparkles className="h-3 w-3" />
							Enriched
						</Badge>
					)}
				</div>
			</div>
		</div>
	);
};
