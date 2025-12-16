import { useUsers } from '@/hooks/queries/users';
import { Alert } from '@OpsiMate/shared';
import { useMemo, useState } from 'react';
import { AlertSortField, SortDirection } from '../AlertsTable.types';
import { sortAlerts } from '../AlertsTable.utils';

export const useAlertSorting = (filteredAlerts: Alert[]) => {
	const { data: users = [] } = useUsers();
	const [sortField, setSortField] = useState<AlertSortField>('startsAt');
	const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

	const sortedAlerts = useMemo(() => {
		if (!sortField) return filteredAlerts;
		return sortAlerts(filteredAlerts, sortField, sortDirection, users);
	}, [filteredAlerts, sortField, sortDirection, users]);

	const handleSort = (field: AlertSortField) => {
		if (sortField === field) {
			setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
		} else {
			setSortField(field);
			setSortDirection(field === 'startsAt' ? 'desc' : 'asc');
		}
	};

	return {
		sortField,
		sortDirection,
		sortedAlerts,
		handleSort,
	};
};
