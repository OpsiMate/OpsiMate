import { TimeRange } from '@/context/DashboardContext';
import { TagKeyInfo } from '@/types';
import { Alert } from '@OpsiMate/shared';

export enum AlertTab {
	Active = 'active',
	Archived = 'archived',
}

export type AlertSortField = string;

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
	isArchived?: boolean;
	className?: string;
	visibleColumns?: string[];
	columnOrder?: string[];
	onAlertClick?: (alert: Alert) => void;
	tagKeyColumnLabels?: Record<string, string>;
	groupByColumns?: string[];
	onGroupByChange?: (cols: string[]) => void;
	onColumnToggle?: (column: string) => void;
	tagKeys?: TagKeyInfo[];
	timeRange?: TimeRange;
	onTimeRangeChange?: (range: TimeRange) => void;
	searchTerm: string;
	onSearchTermChange: (term: string) => void;
}

export interface SortConfig {
	field: AlertSortField;
	direction: SortDirection;
}

export type GroupNode =
	| {
			type: 'group';
			key: string;
			field: string;
			value: string;
			count: number;
			children: GroupNode[];
			level: number;
	  }
	| { type: 'leaf'; alert: Alert };

export type GroupStatus = 'firing' | 'resolved' | 'dismissed';

export type FlatGroupItem =
	| {
			type: 'group';
			key: string;
			field: string;
			value: string;
			count: number;
			level: number;
			isExpanded: boolean;
			groupStatus: GroupStatus;
	  }
	| { type: 'leaf'; alert: Alert };
