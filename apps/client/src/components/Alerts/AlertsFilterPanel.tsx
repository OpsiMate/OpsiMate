import { ActiveFilters, FilterFacets, FilterPanel, FilterPanelConfig } from '@/components/shared';
import { useUsers } from '@/hooks/queries/users';
import { extractTagKeyFromColumnId, getTagKeyColumnId, isTagKeyColumn, TagKeyInfo } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';
import { getOwnerDisplayName } from './utils/owner.utils';
import { getAlertSeverity, SEVERITY_LABELS } from './utils/severity.utils';

interface AlertsFilterPanelProps {
	alerts: Alert[];
	filters: ActiveFilters;
	onFilterChange: (filters: ActiveFilters) => void;
	collapsed?: boolean;
	className?: string;
	tagKeys?: TagKeyInfo[];
	isArchived?: boolean;
}

const BASE_FILTER_FIELDS = ['status', 'severity', 'type', 'alertName', 'owner'];

const BASE_FIELD_LABELS: Record<string, string> = {
	status: 'Status',
	severity: 'Severity',
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
		// The value an alert presents for a given filter field, matching useAlertsFiltering's logic.
		const getFieldValue = (alert: Alert, field: string): string => {
			if (isTagKeyColumn(field)) {
				const tagKey = extractTagKeyFromColumnId(field);
				return tagKey ? alert.tags?.[tagKey] || '' : '';
			}
			switch (field) {
				case 'status':
					return alert.isDismissed
						? 'Dismissed'
						: alert.isSilenced
							? 'Silenced'
							: capitalizeFirst(alert.status);
				case 'severity':
					return SEVERITY_LABELS[getAlertSeverity(alert)];
				case 'type':
					return getAlertType(alert);
				case 'alertName':
					return alert.alertName ?? '';
				case 'owner':
					return getOwnerDisplayName(alert.ownerId, users);
				default:
					return '';
			}
		};

		// Faceted filtering: an alert counts toward a field's facet only if it passes every OTHER
		// active filter. A facet never constrains itself, so its own options stay fully visible.
		const passesOtherFilters = (alert: Alert, exceptField: string): boolean => {
			for (const [field, values] of Object.entries(filters)) {
				if (!values || values.length === 0 || field === exceptField) continue;
				if (!values.includes(getFieldValue(alert, field))) return false;
			}
			return true;
		};

		const result: FilterFacets = {};
		filterConfig.fields.forEach((field) => {
			const map = new Map<string, number>();
			alerts.forEach((alert) => {
				if (!passesOtherFilters(alert, field)) return;
				const value = getFieldValue(alert, field);
				// alertName/type/status/owner with empty value shouldn't appear as an option.
				if (!value) return;
				map.set(value, (map.get(value) || 0) + 1);
			});
			result[field] = Array.from(map.entries())
				.map(([value, count]) => ({ value, count }))
				.sort((a, b) => {
					if (b.count !== a.count) return b.count - a.count;
					return a.value.localeCompare(b.value);
				});
		});

		return result;
	}, [alerts, filterConfig.fields, filters, users]);

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
