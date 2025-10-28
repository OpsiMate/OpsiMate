import { useMemo } from 'react';
import { Service } from '../../ServiceTable';
import { ServiceWithAlerts } from '../Dashboard.types';

export const useFilteredServices = (
	servicesWithAlerts: ServiceWithAlerts[],
	filters: Record<string, string[]>
): ServiceWithAlerts[] => {
	return useMemo(() => {
		const activeFilterKeys = Object.keys(filters).filter((key) => filters[key].length > 0);
		if (activeFilterKeys.length === 0) {
			return servicesWithAlerts;
		}

		return servicesWithAlerts.filter((service) => {
			return activeFilterKeys.every((key) => {
				const filterValues = filters[key];
				if (Array.isArray(filterValues) && filterValues.length > 0) {
					switch (key) {
						case 'serviceStatus':
						case 'serviceType':
							return filterValues.includes(String(service[key].toLowerCase()));

						case 'providerType':
							return filterValues.includes(String(service.provider?.providerType.toLowerCase()));

						case 'providerName':
							return filterValues.includes(String(service.provider?.name.toLowerCase()));

						case 'containerNamespace':
							return filterValues.includes(String(service.containerDetails?.namespace?.toLowerCase()));

						case 'tags':
							if (!service.tags || service.tags.length === 0) {
								return false;
							}
							return filterValues.every((selectedTag) =>
								service.tags?.some((tag) => tag.name.toLowerCase() === selectedTag.toLowerCase())
							);

						default:
							return filterValues.includes(String(service[key as keyof Service]).toLowerCase());
					}
				}
				return true;
			});
		});
	}, [servicesWithAlerts, filters]);
};
