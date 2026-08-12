import { useUsers } from '@/hooks/queries/users';
import { Alert } from '@OpsiMate/shared';
import { useMemo, useState } from 'react';
import { AlertSortField, SortDirection } from '../AlertsTable.types';
import { sortAlerts } from '../AlertsTable.utils';

// Sort can be CONTROLLED by the parent (Alerts.tsx lifts it up to drive the server query,
// so the loaded page is the top-N under this sort across the whole dataset — not just a
// reorder of the newest 500). When uncontrolled, it holds its own state, preserving the
// standalone behaviour of any table rendered without a parent-managed sort. Either way the
// loaded page is re-sorted client-side with the same shared engine the server uses, so the
// visual order is identical and updates instantly on a header click.
const nextDirectionFor = (field: AlertSortField, current: AlertSortField, currentDir: SortDirection): SortDirection => {
	if (current === field) return currentDir === 'asc' ? 'desc' : 'asc';
	// Time columns: newest first; severity/fix: highest rank first (all desc by default).
	return field === 'startsAt' || field === 'updatedAt' || field === 'severity' || field === 'fix' ? 'desc' : 'asc';
};

export const useAlertSorting = (
	filteredAlerts: Alert[],
	controlledSortField?: AlertSortField,
	controlledSortDirection?: SortDirection,
	onSortChange?: (field: AlertSortField, direction: SortDirection) => void
) => {
	const { data: users = [] } = useUsers();
	const [localSortField, setLocalSortField] = useState<AlertSortField>('startsAt');
	const [localSortDirection, setLocalSortDirection] = useState<SortDirection>('desc');

	const sortField = controlledSortField !== undefined ? controlledSortField : localSortField;
	const sortDirection = controlledSortDirection !== undefined ? controlledSortDirection : localSortDirection;

	const sortedAlerts = useMemo(() => {
		if (!sortField) return filteredAlerts;
		return sortAlerts(filteredAlerts, sortField, sortDirection, users);
	}, [filteredAlerts, sortField, sortDirection, users]);

	const handleSort = (field: AlertSortField) => {
		const nextDirection = nextDirectionFor(field, sortField, sortDirection);
		if (onSortChange) {
			onSortChange(field, nextDirection);
		} else {
			setLocalSortField(field);
			setLocalSortDirection(nextDirection);
		}
	};

	return {
		sortField,
		sortDirection,
		sortedAlerts,
		handleSort,
	};
};
