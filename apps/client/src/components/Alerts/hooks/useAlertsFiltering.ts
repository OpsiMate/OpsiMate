import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';

const getAlertType = (alert: Alert): string => {
	return alert.type || 'Custom';
};

export const useAlertsFiltering = (alerts: Alert[], filters: Record<string, string[]>) => {
	const filteredAlerts = useMemo(() => {
		if (Object.keys(filters).length === 0) return alerts;

		return alerts.filter((alert) => {
			for (const [field, values] of Object.entries(filters)) {
				if (values.length === 0) continue;

				let fieldValue: string;
				switch (field) {
					case 'status':
						fieldValue = alert.isDismissed ? 'Dismissed' : 'Firing';
						break;
					case 'type':
						fieldValue = getAlertType(alert);
						break;
					case 'tag':
						fieldValue = alert.tag ?? '';
						break;
					case 'alertName':
						fieldValue = alert.alertName ?? '';
						break;
					default:
						continue;
				}

				if (!values.includes(fieldValue)) {
					return false;
				}
			}
			return true;
		});
	}, [alerts, filters]);

	return filteredAlerts;
};
