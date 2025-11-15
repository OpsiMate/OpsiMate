import { Service } from '../../ServiceTable';
import { useMemo } from 'react';
import {
	FilterPanel as SharedFilterPanel,
	FilterFacets,
	ActiveFilters,
	FilterPanelConfig,
} from '@/components/shared';

export type Filters = ActiveFilters;

interface FilterPanelProps {
	services: Service[];
	filters: Filters;
	onFilterChange: (filters: Filters) => void;
	collapsed: boolean;
}

const FILTER_CONFIG: FilterPanelConfig = {
	fields: ['serviceStatus', 'serviceType', 'providerType', 'providerName', 'containerNamespace', 'tags'],
	fieldLabels: {
		serviceStatus: 'Status',
		serviceType: 'Service Type',
		providerType: 'Provider Type',
		providerName: 'Provider Name',
		containerNamespace: 'Container Namespace',
		tags: 'Tags',
	},
};

const formatFilterValue = (value: string): string => {
	const uppercaseValues: Record<string, string> = {
		vm: 'VM',
		k8s: 'K8S',
		kubernetes: 'K8S',
		ssh: 'SSH',
		docker: 'Docker',
		systemd: 'Systemd',
		manual: 'Manual',
	};

	const lowerValue = value.toLowerCase();
	if (uppercaseValues[lowerValue]) {
		return uppercaseValues[lowerValue];
	}

	return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

export const FilterPanel = ({ services, filters, onFilterChange, collapsed }: FilterPanelProps) => {
	const facets: FilterFacets = useMemo(() => {
		const facetData: Record<string, Map<string, number>> = {};

		FILTER_CONFIG.fields.forEach((field) => {
			facetData[field] = new Map();
		});

		services.forEach((service) => {
			if (service.serviceStatus) {
				const value = String(service.serviceStatus.toLowerCase());
				facetData.serviceStatus.set(value, (facetData.serviceStatus.get(value) || 0) + 1);
			}

			if (service.serviceType) {
				const value = String(service.serviceType);
				facetData.serviceType.set(value, (facetData.serviceType.get(value) || 0) + 1);
			}

			if (service.provider?.providerType) {
				const value = String(service.provider.providerType);
				facetData.providerType.set(value, (facetData.providerType.get(value) || 0) + 1);
			}

			if (service.provider?.name) {
				const value = String(service.provider.name);
				facetData.providerName.set(value, (facetData.providerName.get(value) || 0) + 1);
			}

			if (service.containerDetails?.namespace) {
				const value = String(service.containerDetails.namespace);
				facetData.containerNamespace.set(value, (facetData.containerNamespace.get(value) || 0) + 1);
			}

			if (service.tags && service.tags.length > 0) {
				service.tags.forEach((tag) => {
					const value = String(tag.name);
					facetData.tags.set(value, (facetData.tags.get(value) || 0) + 1);
				});
			}
		});

		const result: FilterFacets = {};
		Object.entries(facetData).forEach(([field, map]) => {
			result[field] = Array.from(map.entries())
				.map(([value, count]) => ({
					value,
					count,
					displayValue: formatFilterValue(value),
				}))
				.sort((a, b) => a.displayValue.localeCompare(b.displayValue));
		});

		return result;
	}, [services]);

	return (
		<SharedFilterPanel
			config={FILTER_CONFIG}
			facets={facets}
			filters={filters}
			onFilterChange={onFilterChange}
			collapsed={collapsed}
			variant="default"
		/>
	);
};
