import { TimeRange } from '@/context/DashboardContext';
import { TagKeyInfo } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { ReactNode } from 'react';

export enum AlertTab {
	Active = 'active',
	Resolved = 'resolved',
	All = 'all',
}

export type AlertSortField = string;

export type SortDirection = 'asc' | 'desc';

export interface AlertsTableProps {
	// Invoked when the scroll approaches the last loaded row — the parent fetches the
	// next server page. Absent when the loaded set is complete.
	onEndReached?: () => void;
	alerts: Alert[];
	onSilenceAlert?: (alertId: string) => void;
	onUnsilenceAlert?: (alertId: string) => void;
	onDeleteAlert?: (alertId: string) => void;
	onUnresolveAlert?: (alertId: string) => void;
	onSelectAlerts?: (alerts: Alert[]) => void;
	selectedAlerts?: Alert[];
	isLoading?: boolean;
	isResolved?: boolean;
	className?: string;
	visibleColumns?: string[];
	columnOrder?: string[];
	onAlertClick?: (alert: Alert) => void;
	// Alert currently open in the details panel; its row is highlighted.
	activeAlertId?: string | null;
	tagKeyColumnLabels?: Record<string, string>;
	groupByColumns?: string[];
	onGroupByChange?: (cols: string[]) => void;
	// Controlled sort — lifted to the parent so it can drive the SERVER query (the loaded
	// page becomes the top-N under this sort across all alerts, not a reorder of the page).
	sortField?: AlertSortField;
	sortDirection?: SortDirection;
	onSortChange?: (field: AlertSortField, direction: SortDirection) => void;
	// Server-computed group summaries (true counts + rollup status over the FULL matching
	// set), joined onto rendered group headers by key. Provided when the grouped view is
	// too large to load whole, so headers stay honest while rows page in progressively.
	groupSummaryByKey?: Map<string, { count: number; status: GroupStatus }>;
	onColumnToggle?: (column: string) => void;
	// Persists a user-arranged base-column order (from the column settings drag list).
	onColumnOrderChange?: (columns: string[]) => void;
	tagKeys?: TagKeyInfo[];
	timeRange?: TimeRange;
	onTimeRangeChange?: (range: TimeRange) => void;
	searchTerm: string;
	onSearchTermChange: (term: string) => void;
	renderToolbar?: boolean;
	// Tint rows by alert severity (the page-level "severity colors" toggle).
	severityColors?: boolean;
	// Wrap cell content onto new lines instead of truncating (the page-level
	// "expand rows" toggle).
	expandRows?: boolean;
	// Optional caption rendered flush at the top of the table container (e.g. a section
	// title + count), so callers don't need a separate header row above the table.
	heading?: ReactNode;
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

export type GroupStatus = 'firing' | 'muted' | 'resolved' | 'silenced';

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
