import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { createServiceNameLookup as createServiceNameLookupShared } from '../utils';
import { CARD_SIZE_THRESHOLDS, CardSize } from './AlertsTVMode.constants';

export { createServiceNameLookupShared as createServiceNameLookup };

export const getCardSize = (count: number): CardSize => {
	if (count <= CARD_SIZE_THRESHOLDS.large) return 'large';
	if (count <= CARD_SIZE_THRESHOLDS.medium) return 'medium';
	if (count <= CARD_SIZE_THRESHOLDS.small) return 'small';
	return 'extra-small';
};

export const getAlertServiceId = (alert: Alert): number | undefined => {
	if (!alert?.id) return undefined;

	const alertWithServiceId = alert as Alert & { serviceId?: number };
	if (alertWithServiceId.serviceId !== undefined) {
		return Number.isFinite(alertWithServiceId.serviceId) ? alertWithServiceId.serviceId : undefined;
	}

	const idPattern = /^[^:]+:(\d+)(?::|$)/;
	const match = alert.id.match(idPattern);

	if (match && match[1]) {
		const serviceId = Number(match[1]);
		return Number.isFinite(serviceId) ? serviceId : undefined;
	}

	return undefined;
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
