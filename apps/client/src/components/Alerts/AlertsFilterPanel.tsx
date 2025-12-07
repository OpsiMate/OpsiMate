import { ActiveFilters, FilterFacets, FilterPanel, FilterPanelConfig } from '@/components/shared';
import { getTagKeyColumnId, TagKeyInfo } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';

interface AlertsFilterPanelProps {
	alerts: Alert[];
	filters: ActiveFilters;
	onFilterChange: (filters: ActiveFilters) => void;
	collapsed?: boolean;
	className?: string;
	enabledTagKeys?: TagKeyInfo[];
}

const BASE_FILTER_FIELDS = ['status', 'type', 'alertName'];

const BASE_FIELD_LABELS: Record<string, string> = {
	status: 'Status',
	type: 'Type',
	alertName: 'Alert Name',
};

export const AlertsFilterPanel = ({
	alerts,
	filters,
	onFilterChange,
	collapsed = false,
	className,
	enabledTagKeys = [],
}: AlertsFilterPanelProps) => {
	const getAlertType = (alert: Alert): string => {
		return alert.type || 'Custom';
	};

	const filterConfig: FilterPanelConfig = useMemo(() => {
		const tagKeyFields = enabledTagKeys.map((tk) => getTagKeyColumnId(tk.key));
		const tagKeyLabels: Record<string, string> = {};
		enabledTagKeys.forEach((tk) => {
			tagKeyLabels[getTagKeyColumnId(tk.key)] = tk.label;
		});

		return {
			fields: [...BASE_FILTER_FIELDS, ...tagKeyFields],
			fieldLabels: { ...BASE_FIELD_LABELS, ...tagKeyLabels },
		};
	}, [enabledTagKeys]);

	const facets: FilterFacets = useMemo(() => {
		const facetData: Record<string, Map<string, number>> = {};

		filterConfig.fields.forEach((field) => {
			facetData[field] = new Map();
		});

		alerts.forEach((alert) => {
			const status = alert.isDismissed ? 'Dismissed' : alert.status;
			facetData.status.set(status, (facetData.status.get(status) || 0) + 1);

			const type = getAlertType(alert);
			facetData.type.set(type, (facetData.type.get(type) || 0) + 1);

			if (alert.alertName) {
				facetData.alertName.set(alert.alertName, (facetData.alertName.get(alert.alertName) || 0) + 1);
			}

			enabledTagKeys.forEach((tagKeyInfo) => {
				const colId = getTagKeyColumnId(tagKeyInfo.key);
				const value = alert.tags?.[tagKeyInfo.key];
				if (value) {
					facetData[colId].set(value, (facetData[colId].get(value) || 0) + 1);
				}
			});
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
	}, [alerts, filterConfig.fields, enabledTagKeys]);

	return (
		<FilterPanel
			config={filterConfig}
			facets={facets}
			filters={filters}
			onFilterChange={onFilterChange}
			collapsed={collapsed}
			className={className}
			variant="compact"
		/>
	);
};
