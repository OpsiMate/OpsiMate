import { ActiveFilters, FilterFacets, FilterPanel, FilterPanelConfig } from '@/components/shared';
import { useUsers } from '@/hooks/queries/users';
import { getTagKeyColumnId, TagKeyInfo } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';
import { getOwnerDisplayName } from './utils/owner.utils';

interface AlertsFilterPanelProps {
	alerts: Alert[];
	filters: ActiveFilters;
	onFilterChange: (filters: ActiveFilters) => void;
	collapsed?: boolean;
	className?: string;
	tagKeys?: TagKeyInfo[];
	isArchived?: boolean;
}

const BASE_FILTER_FIELDS = ['status', 'type', 'alertName', 'owner'];

const BASE_FIELD_LABELS: Record<string, string> = {
	status: 'Status',
	type: 'Type',
	alertName: 'Alert Name',
	owner: 'Owner',
};

export const AlertsFilterPanel = ({
	alerts,
	filters,
	onFilterChange,
	collapsed = false,
	className,
	tagKeys = [],
	isArchived = false,
}: AlertsFilterPanelProps) => {
	const { data: users = [] } = useUsers();

	const getAlertType = (alert: Alert): string => {
		return alert.type || 'Custom';
	};

	const capitalizeFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

	const filterConfig: FilterPanelConfig = useMemo(() => {
		const tagKeyFields = tagKeys.map((tk) => getTagKeyColumnId(tk.key));
		const tagKeyLabels: Record<string, string> = {};
		tagKeys.forEach((tk) => {
			tagKeyLabels[getTagKeyColumnId(tk.key)] = tk.label;
		});

		const baseFields = isArchived ? BASE_FILTER_FIELDS.filter((f) => f !== 'status') : BASE_FILTER_FIELDS;

		return {
			fields: [...baseFields, ...tagKeyFields],
			fieldLabels: { ...BASE_FIELD_LABELS, ...tagKeyLabels },
		};
	}, [tagKeys, isArchived]);

	const facets: FilterFacets = useMemo(() => {
		const facetData: Record<string, Map<string, number>> = {};

		filterConfig.fields.forEach((field) => {
			facetData[field] = new Map();
		});

		alerts.forEach((alert) => {
			if (facetData.status) {
				const status = alert.isDismissed ? 'Dismissed' : capitalizeFirst(alert.status);
				facetData.status.set(status, (facetData.status.get(status) || 0) + 1);
			}

			const type = getAlertType(alert);
			facetData.type.set(type, (facetData.type.get(type) || 0) + 1);

			if (alert.alertName) {
				facetData.alertName.set(alert.alertName, (facetData.alertName.get(alert.alertName) || 0) + 1);
			}

			const ownerName = getOwnerDisplayName(alert.ownerId, users);
			facetData.owner.set(ownerName, (facetData.owner.get(ownerName) || 0) + 1);

			tagKeys.forEach((tagKeyInfo) => {
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
				.map(([value, count]) => ({
					value,
					count,
				}))
				.sort((a, b) => {
					if (b.count !== a.count) return b.count - a.count;
					return a.value.localeCompare(b.value);
				});
		});

		return result;
	}, [alerts, filterConfig.fields, tagKeys, users]);

	return (
		<FilterPanel
			config={filterConfig}
			facets={facets}
			filters={filters}
			onFilterChange={onFilterChange}
			collapsed={collapsed}
			className={className}
		/>
	);
};
