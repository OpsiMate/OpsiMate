import { PersonPicker } from '@/components/PersonPicker';
import { useSetAlertOwner } from '@/hooks/queries/alerts';
import { cn } from '@/lib/utils';
import { useUsers } from '@/hooks/queries/users';
import { Alert, AlertStatus } from '@OpsiMate/shared';
import { BellOff, CircleCheck, Flame, Sparkles } from 'lucide-react';
import { IntegrationAvatar, resolveAlertIntegration } from '../../IntegrationAvatar';
import { SeverityBadge } from '../../SeverityBadge';
import { getAlertSeverity } from '../../utils/severity.utils';

interface AlertInfoSectionProps {
	alert: Alert;
}

// Icon + color for the alert's lifecycle state, shown icon-only (tooltip carries the label)
// to keep the owner row compact.
const getStatusIndicator = (alert: Alert) => {
	if (alert.isDismissed) return { Icon: BellOff, label: 'Dismissed', className: 'text-muted-foreground' };
	if (alert.status === AlertStatus.FIRING) return { Icon: Flame, label: 'Firing', className: 'text-red-500' };
	return { Icon: CircleCheck, label: 'Resolved', className: 'text-emerald-500' };
};

export const AlertInfoSection = ({ alert }: AlertInfoSectionProps) => {
	const integration = resolveAlertIntegration(alert);
	const { data: users = [] } = useUsers();
	const { mutate: setOwner } = useSetAlertOwner();
	const status = getStatusIndicator(alert);

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
					<span className={cn('flex-shrink-0', status.className)} title={`Status: ${status.label}`}>
						<status.Icon className="h-3.5 w-3.5" aria-label={status.label} />
					</span>
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
