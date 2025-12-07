import { Alert } from '@OpsiMate/shared';
import { getIntegrationLabel, IntegrationAvatar, resolveAlertIntegration } from '../../../IntegrationAvatar';

export interface TypeAvatarStackProps {
	alert: Alert;
}

export const TypeAvatarStack = ({ alert }: TypeAvatarStackProps) => {
	const integration = resolveAlertIntegration(alert);
	const integrationLabel = getIntegrationLabel(integration);

	return (
		<div className="flex items-center gap-2">
			<div className="flex -space-x-1.5" aria-label={`${integrationLabel} alert type`}>
				<IntegrationAvatar integration={integration} size="sm" className="ring-2 ring-background shadow-sm" />
			</div>
			<span className="text-xs font-medium text-muted-foreground">{integrationLabel}</span>
		</div>
	);
};
