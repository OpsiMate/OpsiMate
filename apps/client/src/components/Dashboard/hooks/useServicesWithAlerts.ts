import { getAlertServiceId } from '@/utils/alert.utils';
import { Alert, Logger } from '@OpsiMate/shared';
import { useMemo } from 'react';
import { Service } from '../../ServiceTable';
import { ServiceWithAlerts } from '../Dashboard.types';

const logger = new Logger('useServicesWithAlerts');

export const useServicesWithAlerts = (services: Service[], alerts: Alert[]): ServiceWithAlerts[] => {
	return useMemo(() => {
		logger.info('Debug - Services:', { extraArgs: { servicesCount: services.length, alertsCount: alerts.length } });

		return services.map((service) => {
			logger.info(`Service ${service.name} tags:`, {
				extraArgs: { tags: service.tags?.map((t) => t.name) || [] },
			});

			const sid = Number(service.id);
			const serviceAlerts = alerts.filter((alert) => {
				logger.info(`Checking alert ${alert.id} (tag: ${alert.tag}) against service ${service.name}`);
				const explicitSid = getAlertServiceId(alert);
				const matches =
					explicitSid !== undefined
						? explicitSid === sid
						: service.tags?.some((tag) => tag.name === alert.tag);
				logger.info(`Match result: ${matches}`);
				return matches;
			});

			const uniqueAlerts = serviceAlerts.filter((a, i, self) => i === self.findIndex((b) => b.id === a.id));
			const activeAlerts = uniqueAlerts.filter((a) => !a.isDismissed);

			logger.info(
				`Service ${service.name} final result: ${activeAlerts.length} active, ${uniqueAlerts.length - activeAlerts.length} dismissed`
			);

			return {
				...service,
				alertsCount: activeAlerts.length,
				serviceAlerts: uniqueAlerts,
			};
		});
	}, [services, alerts]);
};
