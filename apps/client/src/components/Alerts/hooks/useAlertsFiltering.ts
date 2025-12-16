import { useUsers } from '@/hooks/queries/users';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';
import { getOwnerDisplayName } from '../utils/owner.utils';

const getAlertType = (alert: Alert): string => {
	return alert.type || 'Custom';
};

export const useAlertsFiltering = (alerts: Alert[], filters: Record<string, string[]>) => {
	const { data: users = [] } = useUsers();

	const filteredAlerts = useMemo(() => {
		if (Object.keys(filters).length === 0) return alerts;

		return alerts.filter((alert) => {
			for (const [field, values] of Object.entries(filters)) {
				if (values.length === 0) continue;

				if (isTagKeyColumn(field)) {
					const tagKey = extractTagKeyFromColumnId(field);
					if (tagKey) {
						const tagValue = alert.tags?.[tagKey] || '';
						if (!values.includes(tagValue)) {
							return false;
						}
					}
					continue;
				}

				let fieldValue: string;
				switch (field) {
					case 'status':
						fieldValue = alert.isDismissed ? 'Dismissed' : alert.status;
						break;
					case 'type':
						fieldValue = getAlertType(alert);
						break;
					case 'alertName':
						fieldValue = alert.alertName ?? '';
						break;
					case 'owner':
						fieldValue = getOwnerDisplayName(alert.ownerId, users);
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
	}, [alerts, filters, users]);

	return filteredAlerts;
};
