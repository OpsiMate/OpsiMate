import { Alert } from '@OpsiMate/shared';
import { getIntegrationLabel, resolveAlertIntegration } from '../IntegrationAvatar';
import { AlertSortField, SortDirection } from './AlertsTable.types';

export const filterAlerts = (alerts: Alert[], searchTerm: string): Alert[] => {
	if (!searchTerm.trim()) return alerts;

	const lower = searchTerm.toLowerCase();
	return alerts.filter((alert) => {
		const integration = resolveAlertIntegration(alert);
		const integrationLabel = getIntegrationLabel(integration).toLowerCase();
		const tag = alert.tag?.toLowerCase() || '';
		return (
			alert.alertName.toLowerCase().includes(lower) ||
			alert.status.toLowerCase().includes(lower) ||
			tag.includes(lower) ||
			(alert.summary && alert.summary.toLowerCase().includes(lower)) ||
			integrationLabel.includes(lower)
		);
	});
};

export const sortAlerts = (alerts: Alert[], sortField: AlertSortField, sortDirection: SortDirection): Alert[] => {
	return [...alerts].sort((a, b) => {
		let aValue: string | number;
		let bValue: string | number;

		switch (sortField) {
			case 'alertName':
				aValue = a.alertName.toLowerCase();
				bValue = b.alertName.toLowerCase();
				break;
			case 'status':
				aValue = a.isDismissed ? 'dismissed' : 'firing';
				bValue = b.isDismissed ? 'dismissed' : 'firing';
				break;
			case 'tag':
				aValue = (a.tag ?? '').toLowerCase();
				bValue = (b.tag ?? '').toLowerCase();
				break;
			case 'summary':
				aValue = (a.summary || '').toLowerCase();
				bValue = (b.summary || '').toLowerCase();
				break;
			case 'startsAt': {
				const aDate = new Date(a.startsAt);
				const bDate = new Date(b.startsAt);
				aValue = isNaN(aDate.getTime()) ? 0 : aDate.getTime();
				bValue = isNaN(bDate.getTime()) ? 0 : bDate.getTime();
				break;
			}
			case 'type':
				aValue = getIntegrationLabel(resolveAlertIntegration(a)).toLowerCase();
				bValue = getIntegrationLabel(resolveAlertIntegration(b)).toLowerCase();
				break;
			default:
				return 0;
		}

		if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
		if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
		return 0;
	});
};

export const createServiceNameLookup = (
	services: Array<{ id: string | number; name: string }>
): Record<string | number, string> => {
	const map: Record<string | number, string> = {};
	services.forEach((s) => {
		map[s.id] = s.name;
	});
	return map;
};

export const formatDate = (dateString: string): string => {
	const date = new Date(dateString);
	return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString();
};
