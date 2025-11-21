import { Alert } from '@OpsiMate/shared';
import { CardSize, CARD_SIZE_THRESHOLDS } from './AlertsTVMode.constants';

export const getCardSize = (count: number): CardSize => {
	if (count <= CARD_SIZE_THRESHOLDS.large) return 'large';
	if (count <= CARD_SIZE_THRESHOLDS.medium) return 'medium';
	if (count <= CARD_SIZE_THRESHOLDS.small) return 'small';
	return 'extra-small';
};

export const getAlertServiceId = (alert: Alert): number | undefined => {
	const parts = alert.id.split(':');
	if (parts.length >= 2) {
		const n = Number(parts[1]);
		return Number.isFinite(n) ? n : undefined;
	}
	return undefined;
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

export const filterAlertsByFilters = (
	alerts: Alert[],
	filters: Record<string, string[]>,
	getServiceName: (alert: Alert) => string
): Alert[] => {
	if (Object.keys(filters).length === 0) return alerts;

	return alerts.filter((alert) => {
		for (const [field, values] of Object.entries(filters)) {
			if (!values || values.length === 0) continue;

			let fieldValue: string;
			switch (field) {
				case 'status':
					fieldValue = alert.isDismissed ? 'Dismissed' : 'Firing';
					break;
				case 'tag':
					fieldValue = alert.tag;
					break;
				case 'serviceName': {
					const serviceName = getServiceName(alert);
					fieldValue = serviceName;
					break;
				}
				default:
					continue;
			}

			if (!values.includes(fieldValue)) {
				return false;
			}
		}
		return true;
	});
};
