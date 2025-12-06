import { ActiveFilters, FilterFacets, FilterPanel, FilterPanelConfig } from '@/components/shared';
import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';
import { getAlertTagsArray } from './utils/alertTags.utils';

interface AlertsFilterPanelProps {
	alerts: Alert[];
	filters: ActiveFilters;
	onFilterChange: (filters: ActiveFilters) => void;
	collapsed?: boolean;
	className?: string;
}

const FILTER_CONFIG: FilterPanelConfig = {
	fields: ['status', 'type', 'tag', 'alertName'],
	fieldLabels: {
		status: 'Status',
		type: 'Type',
		tag: 'Tag',
		alertName: 'Alert Name',
	},
};

export const AlertsFilterPanel = ({
	alerts,
	filters,
	onFilterChange,
	collapsed = false,
	className,
}: AlertsFilterPanelProps) => {
	const getAlertType = (alert: Alert): string => {
		return alert.type || 'Custom';
	};

	const facets: FilterFacets = useMemo(() => {
		const facetData: Record<string, Map<string, number>> = {};

		FILTER_CONFIG.fields.forEach((field) => {
			facetData[field] = new Map();
		});

		alerts.forEach((alert) => {
			const status = alert.isDismissed ? 'Dismissed' : alert.status;
			facetData.status.set(status, (facetData.status.get(status) || 0) + 1);

			const type = getAlertType(alert);
			facetData.type.set(type, (facetData.type.get(type) || 0) + 1);

			const tags = getAlertTagsArray(alert);
			tags.forEach((tag) => {
				facetData.tag.set(tag, (facetData.tag.get(tag) || 0) + 1);
			});

			if (alert.alertName) {
				facetData.alertName.set(alert.alertName, (facetData.alertName.get(alert.alertName) || 0) + 1);
			}
		});

		const result: FilterFacets = {};
		Object.entries(facetData).forEach(([field, map]) => {
			result[field] = Array.from(map.entries())
				.map(([value, count]) => ({ value, count }))
				.sort((a, b) => {
					if (b.count !== a.count) return b.count - a.count;
					return a.value.localeCompare(b.value);
				});
		});

		return result;
	}, [alerts]);

	return (
		<FilterPanel
			config={FILTER_CONFIG}
			facets={facets}
			filters={filters}
			onFilterChange={onFilterChange}
			collapsed={collapsed}
			className={className}
			variant="compact"
		/>
	);
};
