import { Alert } from '@OpsiMate/shared';

export type AlertSortField = 'alertName' | 'status' | 'tag' | 'startsAt' | 'summary' | 'type';

export type SortDirection = 'asc' | 'desc';

export interface AlertsTableProps {
	alerts: Alert[];
	services: Array<{ id: string | number; name: string }>;
	onDismissAlert?: (alertId: string) => void;
	onUndismissAlert?: (alertId: string) => void;
	onDeleteAlert?: (alertId: string) => void;
	onSelectAlerts?: (alerts: Alert[]) => void;
	selectedAlerts?: Alert[];
	isLoading?: boolean;
	className?: string;
	onTableSettingsClick?: () => void;
	visibleColumns?: string[];
	columnOrder?: string[];
	onAlertClick?: (alert: Alert) => void;
}

export interface SortConfig {
	field: AlertSortField;
	direction: SortDirection;
}
