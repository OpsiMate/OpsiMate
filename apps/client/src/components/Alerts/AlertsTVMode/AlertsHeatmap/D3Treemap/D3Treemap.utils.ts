import { Alert } from '@OpsiMate/shared';
import { resolveAlertIntegration } from '../../../IntegrationAvatar.utils';

export const getIntegrationIcon = (alert: Alert): string => {
	const integration = resolveAlertIntegration(alert);
	switch (integration) {
		case 'grafana':
			return '🟠';
		case 'gcp':
			return '🔵';
		default:
			return '🔔';
	}
};
