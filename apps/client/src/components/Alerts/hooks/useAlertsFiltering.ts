import { useUsers, UserInfo } from '@/hooks/queries/users';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';

const getAlertType = (alert: Alert): string => {
	return alert.type || 'Custom';
};

const getOwnerDisplayName = (ownerId: number | null | undefined, users: UserInfo[]): string => {
	if (ownerId === null || ownerId === undefined) return 'Unassigned';
	const user = users.find((u) => u.id === ownerId);
	return user?.fullName || `User ${ownerId}`;
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
