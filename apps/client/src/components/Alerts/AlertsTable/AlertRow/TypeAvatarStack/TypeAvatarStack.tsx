import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert } from '@OpsiMate/shared';
import { getIntegrationLabel, IntegrationAvatar, resolveAlertIntegration } from '../../../IntegrationAvatar';

export interface TypeAvatarStackProps {
	alert: Alert;
}

// Icon-only: the integration name lives in the tooltip to keep the column narrow.
export const TypeAvatarStack = ({ alert }: TypeAvatarStackProps) => {
	const integration = resolveAlertIntegration(alert);
	const integrationLabel = getIntegrationLabel(integration);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div className="flex -space-x-1.5 flex-shrink-0" aria-label={`${integrationLabel} alert type`}>
					<IntegrationAvatar
						integration={integration}
						size="sm"
						className="ring-2 ring-background shadow-sm"
					/>
				</div>
			</TooltipTrigger>
			<TooltipContent>{integrationLabel}</TooltipContent>
		</Tooltip>
	);
};
