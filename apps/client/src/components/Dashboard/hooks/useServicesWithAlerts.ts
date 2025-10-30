import { getAlertServiceId } from '@/utils/alert.utils';
import { Alert, Logger } from '@OpsiMate/shared';
import { useMemo } from 'react';
import { Service } from '../../ServiceTable';
import { ServiceWithAlerts } from '../Dashboard.types';

const logger = new Logger('useServicesWithAlerts');

export const useServicesWithAlerts = (services: Service[], alerts: Alert[]): ServiceWithAlerts[] => {
	return useMemo(() => {
		return services.map((service) => {
			const sid = Number(service.id);
			const serviceAlerts = alerts.filter((alert) => {
				const explicitSid = getAlertServiceId(alert);
				const matches =
					explicitSid !== undefined
						? explicitSid === sid
						: service.tags?.some((tag) => tag.name === alert.tag);
				return matches;
			});

			const uniqueAlerts = serviceAlerts.filter((a, i, self) => i === self.findIndex((b) => b.id === a.id));
			const activeAlerts = uniqueAlerts.filter((a) => !a.isDismissed);

			return {
				...service,
				alertsCount: activeAlerts.length,
				serviceAlerts: uniqueAlerts,
			};
		});
	}, [services, alerts]);
};
