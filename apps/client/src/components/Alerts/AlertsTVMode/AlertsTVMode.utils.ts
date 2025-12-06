import { Alert } from '@OpsiMate/shared';
import { alertMatchesTagFilter } from '../utils/alertTags.utils';
import { createServiceNameLookup as createServiceNameLookupShared } from '../utils';
import { CARD_SIZE_THRESHOLDS, CardSize } from './AlertsTVMode.constants';

export { createServiceNameLookupShared as createServiceNameLookup };

export const getCardSize = (count: number): CardSize => {
	if (count <= CARD_SIZE_THRESHOLDS.large) return 'large';
	if (count <= CARD_SIZE_THRESHOLDS.medium) return 'medium';
	if (count <= CARD_SIZE_THRESHOLDS.small) return 'small';
	return 'extra-small';
};

/**
 * Extracts the service ID from an alert.
 *
 * Prefers a dedicated `serviceId` property if present on the alert.
 * Otherwise, attempts to parse the service ID from the alert's `id` field,
 * which is expected to follow the format: `prefix:serviceId:suffix`.
 *
 * @param alert - The alert object
 * @returns The numeric service ID, or undefined if not found or invalid
 */
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

			if (field === 'tag') {
				if (!alertMatchesTagFilter(alert, values)) {
					return false;
				}
				continue;
			}

			let fieldValue: string;
			switch (field) {
				case 'status':
					fieldValue = alert.isDismissed ? 'Dismissed' : 'Firing';
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
