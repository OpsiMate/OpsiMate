import { TimeRange } from '@/context/DashboardContext';
import { useUsers } from '@/hooks/queries/users';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';
import { getOwnerDisplayName } from '../utils/owner.utils';

const getAlertType = (alert: Alert): string => {
	return alert.type || 'Custom';
};

const capitalizeFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

interface UseAlertsFilteringOptions {
	filters: Record<string, string[]>;
	timeRange?: TimeRange;
}

export const useAlertsFiltering = (
	alerts: Alert[],
	filtersOrOptions: Record<string, string[]> | UseAlertsFilteringOptions
) => {
	const { data: users = [] } = useUsers();

	const { filters, timeRange } = useMemo(() => {
		if ('filters' in filtersOrOptions) {
			return {
				filters: filtersOrOptions.filters,
				timeRange: filtersOrOptions.timeRange,
			};
		}
		return { filters: filtersOrOptions, timeRange: undefined };
	}, [filtersOrOptions]);

	const filteredAlerts = useMemo(() => {
		let result = alerts;

		if (timeRange?.from || timeRange?.to) {
			result = result.filter((alert) => {
				const alertStartDate = new Date(alert.startsAt);
				const alertEndDate = new Date(alert.updatedAt);
				const filterStart = timeRange.from || new Date(0);
				const filterEnd = timeRange.to || new Date();

				return alertStartDate <= filterEnd && alertEndDate >= filterStart;
			});
		}

		if (Object.keys(filters).length === 0) return result;

		return result.filter((alert) => {
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
						fieldValue = alert.isDismissed ? 'Dismissed' : capitalizeFirst(alert.status);
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
	}, [alerts, filters, timeRange, users]);

	return filteredAlerts;
};
