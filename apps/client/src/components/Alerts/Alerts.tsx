import { DashboardLayout } from '@/components/DashboardLayout';
import { FilterSidebar } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDashboard } from '@/context/DashboardContext';
import { deserializeTimeRange, readLegacySeverityColors, serializeTimeRange } from '@/context/DashboardContext.utils';
import {
	useAlertFacets,
	useAlertGroupSummaries,
	useAlertMatchCount,
	useAlerts,
	useBulkAlertAction,
	useResolvedAlerts,
	useDeleteResolvedAlert,
	useMarkAlertRead,
} from '@/hooks/queries/alerts';
import {
	useCreateDashboard,
	useDeleteDashboard,
	useGetDashboards,
	useUpdateDashboard,
} from '@/hooks/queries/dashboards';
import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';
import { useToast } from '@/hooks/use-toast';
import { AlertFacetsResponse } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { Bell, BellOff, CheckCircle2, ChevronDown, Columns2, LayoutList, Palette, WrapText } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertsFilterPanel } from '.';
import { AlertDetailsPanel } from './AlertDetails';
import { AlertsSelectionBar } from './AlertsSelectionBar';
import { ConfirmAlertActionDialog, PendingAlertAction } from './ConfirmAlertActionDialog';
import { AlertsTable } from './AlertsTable';
import { AssignmentPane } from './AssignmentPane';
import { VerticalSplit } from './VerticalSplit';
import { ACTIONS_COLUMN } from './AlertsTable/AlertsTable.constants';
import { areSilencedAlertsShown, toggleSilencedAlerts } from './utils/silenced.utils';
import { AlertTab, GroupStatus } from './AlertsTable/AlertsTable.types';
import { SearchBar } from './AlertsTable/SearchBar';
import { TimeFilter, createEmptyTimeRange } from './AlertsTable/TimeFilter';
import { resolveTimeRange } from './AlertsTable/TimeFilter/TimeFilter.utils';
import { TimeRange } from './AlertsTable/TimeFilter/TimeFilter.types';
import { DashboardHeader } from './DashboardHeader';
import { DashboardSettingsDrawer } from './DashboardSettingsDrawer';
import {
	useAlertActions,
	useAlertsFiltering,
	useAlertsRefresh,
	useAlertTagKeys,
	useColumnManagement,
	useExpandRows,
	useFilterPanelCollapsed,
} from './hooks';

// Options for the alert-list picker (one dropdown instead of three toggle buttons);
// per-tab counts come from the filtered lists at render time.
const ALERT_TAB_OPTIONS = [
	{ value: AlertTab.Active, label: 'Active', Icon: Bell },
	{ value: AlertTab.Resolved, label: 'Resolved', Icon: CheckCircle2 },
	{ value: AlertTab.All, label: 'All', Icon: LayoutList },
] as const;

// One page of server-filtered alerts; views under this size (the overwhelmingly common
// case) load completely and every client-side behavior — grouping, sorting, select-all —
// is exactly what it was before server-side querying existed.
const SERVER_PAGE_SIZE = 500;

// Grouping loads the whole matching set, so a 5s poll would re-download all of it every
// tick. A grouped overview doesn't need second-by-second freshness — poll it slower.
const GROUPED_POLL_MS = 20 * 1000;

// Grouped views up to this size load whole (complete client-side grouping, the original
// UX). Above it — resolved tabs holding 50-60k in real deployments — rows page in like a
// flat view while group headers read TRUE totals from the server summaries endpoint.
const GROUP_LOAD_ALL_MAX = 5000;

// Rolling presets re-anchor to "now" continuously; a raw resolved window in the query
// would mint a new cache key every tick. Rounding the window OUTWARD to the minute keeps
// the key stable for a minute at a time while the server window stays a superset — the
// client pipeline narrows to the exact rolling window on top.
const toCoarseWindow = (timeRange: TimeRange | undefined) => {
	if (!timeRange) return { from: null, to: null };
	const resolved = resolveTimeRange(timeRange);
	const floorMinute = (d: Date) => new Date(Math.floor(d.getTime() / 60000) * 60000);
	const ceilMinute = (d: Date) => new Date(Math.ceil(d.getTime() / 60000) * 60000);
	return {
		from: resolved.from ? floorMinute(resolved.from).toISOString() : null,
		to: resolved.to ? ceilMinute(resolved.to).toISOString() : null,
	};
};

// The All view describes active + resolved together: counts add, tag keys union.
const mergeFacetsResponses = (a?: AlertFacetsResponse, b?: AlertFacetsResponse): AlertFacetsResponse | undefined => {
	if (!a || !b) return a ?? b;
	const facets: Record<string, Record<string, number>> = {};
	for (const field of new Set([...Object.keys(a.facets), ...Object.keys(b.facets)])) {
		const merged: Record<string, number> = { ...a.facets[field] };
		for (const [value, count] of Object.entries(b.facets[field] ?? {})) {
			merged[value] = (merged[value] ?? 0) + count;
		}
		facets[field] = merged;
	}
	const tagKeys = new Map<string, { key: string; label: string; values: Set<string> }>();
	for (const tk of [...a.tagKeys, ...b.tagKeys]) {
		const entry = tagKeys.get(tk.key) ?? { key: tk.key, label: tk.label, values: new Set<string>() };
		tk.values.forEach((v) => entry.values.add(v));
		tagKeys.set(tk.key, entry);
	}
	return {
		facets,
		total: a.total + b.total,
		silencedTotal: a.silencedTotal + b.silencedTotal,
		tagKeys: Array.from(tagKeys.values())
			.map((e) => ({ key: e.key, label: e.label, values: Array.from(e.values).sort() }))
			.sort((x, y) => x.label.localeCompare(y.label)),
	};
};

const Alerts = () => {
	const { toast } = useToast();
	const { data: dashboards = [] } = useGetDashboards();
	const createDashboardMutation = useCreateDashboard();
	const updateDashboardMutation = useUpdateDashboard();
	const deleteDashboardMutation = useDeleteDashboard();

	const {
		dashboardState,
		isDirty,
		initialState,
		updateDashboardField,
		markAsClean,
		resetDashboard,
		setShowUnsavedChangesDialog,
		setPendingNavigation,
		setInitialState,
	} = useDashboard();

	// The Resolved and All VIEWS run with the status filter suspended — not deleted
	// (see the view notes below). The SERVER query always uses the suspended record:
	// it's the superset of all three views, so one active query serves them all and the
	// client pipeline narrows by status exactly as it always has.
	const statusSuspendedFilters = useMemo(() => {
		const { status: _status, ['!status']: _notStatus, ...rest } = dashboardState.filters;
		return rest;
	}, [dashboardState.filters]);

	// Sort drives the server query: the loaded page is the top-N under this sort across
	// ALL matching alerts, so sorting by severity surfaces the most critical in the whole
	// dataset — not a reorder of the newest 500. Kept as view-local state (not a dashboard
	// field) so changing it doesn't dirty the dashboard, matching the prior behaviour.
	const [alertSort, setAlertSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({
		field: 'startsAt',
		dir: 'desc',
	});

	// Grouping needs the WHOLE matching set, or headers count only the loaded page — a
	// user grouping by severity must see 3,332 criticals, not "the 166 that happened to
	// load". So when a group-by is active the query drops its limit and the server returns
	// every matching alert (filtered/searched/time-bounded), which the client groups
	// exactly as it always did. Flat views keep the page limit and infinite-scroll.
	const [activeTab, setActiveTab] = useState<AlertTab>(AlertTab.Active);

	const isGrouping = dashboardState.groupBy.length > 0;

	// Grouping loads the WHOLE matching set, but only for the list you're actually
	// looking at. Active alerts number in the thousands; resolved can be 50-60k, so
	// pulling all resolved to group the active tab would be a huge wasted download.
	// Active data feeds the Active and All views; resolved data feeds Resolved and All.
	// The non-viewed list stays a cheap 500-row page — enough for its tab-dropdown count
	// (the response carries the true total regardless of limit) and a ready first page.
	// Both queries already honor the time range, so narrowing the window trims what a
	// grouped view has to load.
	const activeViewed = activeTab === AlertTab.Active || activeTab === AlertTab.All;
	const resolvedViewed = activeTab === AlertTab.Resolved || activeTab === AlertTab.All;

	// Last-known per-list totals (Infinity = not yet known). Written after the queries
	// below resolve; their arrival re-renders, so the next render reads fresh values.
	const lastActiveTotal = useRef(Number.POSITIVE_INFINITY);
	const lastResolvedTotal = useRef(Number.POSITIVE_INFINITY);

	const baseQuery = useMemo(() => {
		const window = toCoarseWindow(dashboardState.timeRange);
		return {
			filters: statusSuspendedFilters,
			from: window.from,
			to: window.to,
			search: dashboardState.query || undefined,
			sort: alertSort.field,
			dir: alertSort.dir,
		};
	}, [statusSuspendedFilters, dashboardState.timeRange, dashboardState.query, alertSort]);

	// Load-all is gated on the last-known total staying under GROUP_LOAD_ALL_MAX: page
	// one's response carries the total (regardless of limit), and when it's small enough
	// the query re-keys to unlimited and grouping is complete — the original UX, at the
	// cost of one extra fetch when grouping turns on. Totals above the threshold keep
	// paging; the summaries endpoint supplies true header counts instead. Unknown totals
	// (first render) page conservatively.
	const activeGroupLoadAll = isGrouping && activeViewed && lastActiveTotal.current <= GROUP_LOAD_ALL_MAX;
	const resolvedGroupLoadAll = isGrouping && resolvedViewed && lastResolvedTotal.current <= GROUP_LOAD_ALL_MAX;

	const activeQuery = useMemo(
		() => ({ ...baseQuery, limit: activeGroupLoadAll ? undefined : SERVER_PAGE_SIZE }),
		[baseQuery, activeGroupLoadAll]
	);
	const resolvedQuery = useMemo(
		() => ({ ...baseQuery, limit: resolvedGroupLoadAll ? undefined : SERVER_PAGE_SIZE }),
		[baseQuery, resolvedGroupLoadAll]
	);

	const {
		data: alerts = [],
		total: activeTotal,
		isLoading,
		refetch,
		fetchNextPage: fetchMoreActive,
		hasNextPage: hasMoreActive,
	} = useAlerts(activeQuery, { refetchIntervalMs: isGrouping && activeViewed ? GROUPED_POLL_MS : undefined });
	const {
		data: resolvedAlerts = [],
		total: resolvedTotal,
		isLoading: isLoadingResolved,
		refetch: refetchResolved,
		fetchNextPage: fetchMoreResolved,
		hasNextPage: hasMoreResolved,
	} = useResolvedAlerts(resolvedQuery, {
		refetchIntervalMs: isGrouping && resolvedViewed ? GROUPED_POLL_MS : undefined,
	});
	lastActiveTotal.current = activeTotal;
	lastResolvedTotal.current = resolvedTotal;

	// True group-header counts for grouped views too large to load whole.
	//
	// Filters must match what the TAB actually renders: the Active view narrows rows by
	// the full filter record (status included), so its summaries query the full record
	// too — a suspended-status summary would count statuses the table excludes. The All
	// view (and Resolved) render with status suspended, so those summaries stay on the
	// suspended record.
	//
	// The All view renders ONE tree over both lists, so when it needs an override at
	// all, BOTH lists' summaries are fetched — merging only the paged side would
	// undercount buckets that exist in both lists.
	const allNeedsSummaries = activeTab === AlertTab.All && (!activeGroupLoadAll || !resolvedGroupLoadAll);
	const activeSummaryQuery = useMemo(
		() => (activeTab === AlertTab.Active ? { ...baseQuery, filters: dashboardState.filters } : baseQuery),
		[activeTab, baseQuery, dashboardState.filters]
	);
	const activeSummaries = useAlertGroupSummaries(dashboardState.groupBy, activeSummaryQuery, {
		enabled: isGrouping && ((activeTab === AlertTab.Active && !activeGroupLoadAll) || allNeedsSummaries),
	});
	const resolvedSummaries = useAlertGroupSummaries(dashboardState.groupBy, baseQuery, {
		resolved: true,
		enabled: isGrouping && ((activeTab === AlertTab.Resolved && !resolvedGroupLoadAll) || allNeedsSummaries),
	});

	// The tab's summary map for header overrides. The All view renders one tree over
	// active+resolved rows, so its buckets are the SUM of both lists' summaries.
	const groupSummaryByKey = useMemo(() => {
		if (!isGrouping) return undefined;
		const onAll = activeTab === AlertTab.All;
		const anyPagedOnAll = onAll && (!activeGroupLoadAll || !resolvedGroupLoadAll);
		const wantActive = anyPagedOnAll || (activeTab === AlertTab.Active && !activeGroupLoadAll);
		const wantResolved = anyPagedOnAll || (activeTab === AlertTab.Resolved && !resolvedGroupLoadAll);
		if (!wantActive && !wantResolved) return undefined;
		const merged = new Map<string, { count: number; status: GroupStatus }>();
		const precedence: GroupStatus[] = ['firing', 'muted', 'resolved', 'silenced'];
		const fold = (map?: Map<string, { count: number; status: GroupStatus }>) => {
			map?.forEach((node, key) => {
				const existing = merged.get(key);
				if (!existing) {
					merged.set(key, { count: node.count, status: node.status });
				} else {
					merged.set(key, {
						count: existing.count + node.count,
						status:
							precedence.indexOf(node.status) < precedence.indexOf(existing.status)
								? node.status
								: existing.status,
					});
				}
			});
		};
		if (wantActive) fold(activeSummaries.byKey);
		if (wantResolved) fold(resolvedSummaries.byKey);
		return merged.size > 0 ? merged : undefined;
	}, [
		isGrouping,
		activeTab,
		activeGroupLoadAll,
		resolvedGroupLoadAll,
		activeSummaries.byKey,
		resolvedSummaries.byKey,
	]);

	const [selectedAlerts, setSelectedAlerts] = useState<Alert[]>([]);
	// "Select all N matching" scope: when armed, bulk actions act on EVERY alert matching
	// the Active view's query — resolved server-side against the full dataset — not just
	// the loaded selection. Any change to the selection or to what the view shows drops
	// the flag: the N the user confirmed is no longer what the query means.
	const [allMatchingSelected, setAllMatchingSelected] = useState(false);
	const handleSelectAlerts = (next: Alert[]) => {
		setSelectedAlerts(next);
		setAllMatchingSelected(false);
	};
	useEffect(() => {
		setAllMatchingSelected(false);
	}, [activeTab, dashboardState.filters, dashboardState.query, dashboardState.timeRange]);
	const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
	const [showDashboardSettings, setShowDashboardSettings] = useState(false);
	const [pendingAction, setPendingAction] = useState<PendingAlertAction | null>(null);
	// Both toolbar toggles live in the dashboard, so a saved dashboard reproduces the view
	// the user actually works with; the draft state is persisted per-browser meanwhile.
	const { splitByAssignment, severityColors } = dashboardState;
	const { expandRows, toggleExpandRows } = useExpandRows();
	const { filterPanelCollapsed, toggleFilterPanelCollapsed } = useFilterPanelCollapsed();

	const allAlerts = useMemo(() => [...alerts, ...resolvedAlerts], [alerts, resolvedAlerts]);

	// Sidebar facets, tag keys and the silenced total come from the server, computed
	// over the RAW dataset — the loaded page is filtered, so deriving them from it
	// would shrink the sidebar to what's already visible. Three variants because each
	// view facets under its own effective filters. The client derivation stays as the
	// fallback (facets request in flight or failed).
	const activeFacets = useAlertFacets(dashboardState.filters);
	const suspendedActiveFacets = useAlertFacets(statusSuspendedFilters);
	const resolvedFacets = useAlertFacets(statusSuspendedFilters, { resolved: true });

	const clientTagKeys = useAlertTagKeys(allAlerts);
	const tagKeys = useMemo(() => {
		const active = activeFacets.data?.tagKeys;
		const resolved = resolvedFacets.data?.tagKeys;
		if (!active && !resolved) return clientTagKeys;
		const merged = new Map<string, { key: string; label: string; values: Set<string> }>();
		for (const tk of [...(active ?? []), ...(resolved ?? [])]) {
			const entry = merged.get(tk.key) ?? { key: tk.key, label: tk.label, values: new Set<string>() };
			tk.values.forEach((v) => entry.values.add(v));
			merged.set(tk.key, entry);
		}
		return Array.from(merged.values())
			.map((e) => ({ key: e.key, label: e.label, values: Array.from(e.values).sort() }))
			.sort((a, b) => a.label.localeCompare(b.label));
	}, [activeFacets.data?.tagKeys, resolvedFacets.data?.tagKeys, clientTagKeys]);

	const currentAlertData =
		activeTab === AlertTab.Active ? alerts : activeTab === AlertTab.Resolved ? resolvedAlerts : allAlerts;
	// Sync against both lists (not just the active tab's) so the details panel follows the
	// alert through resolve/unresolve transitions instead of freezing on its pre-action state.
	const syncedSelectedAlert = useMemo(() => {
		if (!selectedAlert) return null;
		const updatedAlert = allAlerts.find((alert) => alert.id === selectedAlert.id);
		return updatedAlert || selectedAlert;
	}, [selectedAlert, allAlerts]);

	const shouldPauseRefresh = showDashboardSettings;

	const {
		lastRefresh: lastRefreshActive,
		isRefreshing: isRefreshingActive,
		handleManualRefresh: handleManualRefreshActive,
	} = useAlertsRefresh(refetch, {
		shouldPause: shouldPauseRefresh || (activeTab !== AlertTab.Active && activeTab !== AlertTab.All),
	});

	const {
		lastRefresh: lastRefreshResolved,
		isRefreshing: isRefreshingResolved,
		handleManualRefresh: handleManualRefreshResolved,
	} = useAlertsRefresh(refetchResolved, {
		shouldPause: shouldPauseRefresh || (activeTab !== AlertTab.Resolved && activeTab !== AlertTab.All),
	});

	const lastRefresh = activeTab === AlertTab.Resolved ? lastRefreshResolved : lastRefreshActive;
	const isRefreshing =
		activeTab === AlertTab.Active
			? isRefreshingActive
			: activeTab === AlertTab.Resolved
				? isRefreshingResolved
				: isRefreshingActive || isRefreshingResolved;
	const handleManualRefresh =
		activeTab === AlertTab.Active
			? handleManualRefreshActive
			: activeTab === AlertTab.Resolved
				? handleManualRefreshResolved
				: () => {
						handleManualRefreshActive();
						handleManualRefreshResolved();
					};

	const { visibleColumns, columnOrder, handleColumnToggle, allColumnLabels, enabledTagKeys } = useColumnManagement({
		tagKeys,
		visibleColumns: dashboardState.visibleColumns,
		columnOrder: dashboardState.columnOrder,
		onVisibleColumnsChange: (columns) =>
			updateDashboardField(
				'visibleColumns',
				columns.filter((col) => col !== ACTIONS_COLUMN)
			),
	});

	// Persist a user-arranged base-column order (tag columns follow the visible list).
	const handleColumnOrderChange = (columns: string[]) => {
		updateDashboardField(
			'columnOrder',
			columns.filter((col) => col !== ACTIONS_COLUMN)
		);
	};

	const handleSaveDashboard = async () => {
		const dashboardData = {
			name: dashboardState.name || 'New Dashboard',
			type: dashboardState.type,
			description: dashboardState.description,
			filters: dashboardState.filters,
			// Persist the EFFECTIVE columns/order (what's rendered), not the raw state:
			// the raw state can be empty (render falls back to defaults) or missing the
			// injected severity / appended tag columns — saving it means the arrangement
			// on screen is not the arrangement that comes back on the next load.
			visibleColumns: visibleColumns.filter((col) => col !== ACTIONS_COLUMN),
			columnOrder: columnOrder.filter((col) => col !== ACTIONS_COLUMN),
			splitByAssignment: dashboardState.splitByAssignment,
			severityColors: dashboardState.severityColors,
			query: dashboardState.query,
			groupBy: dashboardState.groupBy,
			timeRange: serializeTimeRange(dashboardState.timeRange),
		};

		try {
			if (dashboardState.id) {
				await updateDashboardMutation.mutateAsync({
					id: dashboardState.id,
					...dashboardData,
				});
			} else {
				const result = await createDashboardMutation.mutateAsync(dashboardData);
				if (result?.id) {
					updateDashboardField('id', result.id);
				}
			}
			markAsClean();
			toast({
				title: 'Dashboard saved',
				description: 'Your changes have been saved successfully.',
			});
		} catch (error) {
			toast({
				title: 'Error saving dashboard',
				description: 'Failed to save dashboard changes',
				variant: 'destructive',
			});
		}
	};

	const handleFilterChange = (newFilters: Record<string, string[]>) => {
		updateDashboardField('filters', newFilters);
	};

	// Scope of "apply to all N matching": the Active view's FULL query — the complete
	// filter record (status included, exactly what narrows the rows the user sees), the
	// time window and the search — which the server resolves against the whole dataset.
	// Built as a FUNCTION so the mutation resolves the rolling window at action time: a
	// memo would freeze "last 15 minutes" at mount (the preset's object identity never
	// changes) and a selection left open for an hour would act on an hour-stale window.
	const buildBulkScopeQuery = () => {
		const window = toCoarseWindow(dashboardState.timeRange);
		return {
			filters: dashboardState.filters,
			from: window.from ?? undefined,
			to: window.to ?? undefined,
			search: dashboardState.query || undefined,
		};
	};
	// The count query needs a STABLE object for its key, so it memoizes — with a slow
	// tick re-resolving the rolling window, keeping the displayed N within a minute of
	// what the action would do. The tick only runs while something consumes a count:
	// an open selection, or the split-by-owner panes.
	const bulkCountEnabled = activeTab === AlertTab.Active && selectedAlerts.length > 0;
	const splitCountsEnabled = splitByAssignment === true && activeTab === AlertTab.Active;
	const [bulkWindowTick, setBulkWindowTick] = useState(0);
	useEffect(() => {
		if (!bulkCountEnabled && !splitCountsEnabled) return;
		const timer = setInterval(() => setBulkWindowTick((t) => t + 1), 30 * 1000);
		return () => clearInterval(timer);
	}, [bulkCountEnabled, splitCountsEnabled]);
	const bulkCountQuery = useMemo(
		() => buildBulkScopeQuery(),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[dashboardState.filters, dashboardState.timeRange, dashboardState.query, bulkWindowTick]
	);
	const bulkMatchCount = useAlertMatchCount(bulkCountQuery, bulkCountEnabled);

	// True totals for the split-by-owner panes. The loaded page splits 500 rows into
	// "assigned 200 / unassigned 300" — a lie when thousands match — so each pane's count
	// comes from a limit-1 server query over the SAME full view query, constrained by
	// owner ('Unassigned' is the engine's display value for ownerless alerts; !owner
	// excludes it). Only fetched while the split view is on.
	const unassignedCountQuery = useMemo(
		() => ({ ...bulkCountQuery, filters: { ...bulkCountQuery.filters, owner: ['Unassigned'] } }),
		[bulkCountQuery]
	);
	const assignedCountQuery = useMemo(
		() => ({ ...bulkCountQuery, filters: { ...bulkCountQuery.filters, ['!owner']: ['Unassigned'] } }),
		[bulkCountQuery]
	);
	const unassignedTotal = useAlertMatchCount(unassignedCountQuery, splitCountsEnabled);
	const assignedTotal = useAlertMatchCount(assignedCountQuery, splitCountsEnabled);

	// Derived from the filters themselves rather than tracked separately, so the button and
	// the sidebar's Status section always describe the same thing. The count comes from the
	// unfiltered active list — the point of the button is to reveal alerts the current
	// filters are hiding, so it has to say how many are out there.
	const silencedShown = areSilencedAlertsShown(dashboardState.filters);
	const silencedCount = activeFacets.data?.silencedTotal ?? alerts.filter((a) => a.isSilenced).length;

	const filteredAlerts = useAlertsFiltering(alerts, {
		filters: dashboardState.filters,
		timeRange: dashboardState.timeRange,
	});
	// Resolved: an active status like Firing/Silenced can never match resolved alerts,
	// so applying it would make the view silently empty. All: the tab's promise is
	// every alert regardless of status, so a status filter picked on Active must not
	// follow the user there — the stored filters stay intact and Active keeps applying
	// them (narrowing the suspended superset the server returned).
	const resolvedViewAlerts = useAlertsFiltering(resolvedAlerts, {
		filters: statusSuspendedFilters,
		timeRange: dashboardState.timeRange,
	});
	// Active alerts for the All view — same suspension, all statuses shown.
	const allViewActiveAlerts = useAlertsFiltering(alerts, {
		filters: statusSuspendedFilters,
		timeRange: dashboardState.timeRange,
	});

	// Split the active, filtered alerts by assignment for the side-by-side view.
	const unassignedAlerts = useMemo(() => filteredAlerts.filter((a) => !a.ownerId), [filteredAlerts]);
	const assignedAlerts = useMemo(() => filteredAlerts.filter((a) => !!a.ownerId), [filteredAlerts]);

	// Combined "All" view: active alerts followed by resolved ones tagged so each row can route
	// its own actions. resolvedIds lets shared callbacks tell which list an alert belongs to.
	const resolvedIds = useMemo(() => new Set(resolvedAlerts.map((a) => a.id)), [resolvedAlerts]);
	const filteredAllAlerts = useMemo(
		() => [...allViewActiveAlerts, ...resolvedViewAlerts.map((a) => ({ ...a, isResolved: true }))],
		[allViewActiveAlerts, resolvedViewAlerts]
	);

	const {
		handleSilenceAlert,
		handleUnsilenceAlert,
		handleDeleteAlert,
		handleUnresolveAlert,
		handleDeleteForeverAll,
	} = useAlertActions();
	const deleteResolvedAlertMutation = useDeleteResolvedAlert();
	const markAlertReadMutation = useMarkAlertRead();
	const bulkAction = useBulkAlertAction();

	// Bulk actions run as ONE server request: over the explicit ids of the loaded
	// selection, or — when "all matching" is armed — over the view's query, resolved
	// server-side against the full dataset. The response counts drive the toast, so it
	// reports what actually happened rather than what the client hoped.
	const runBulkAction = async (
		vars: {
			action: 'silence' | 'unsilence' | 'resolve' | 'assignOwner' | 'comment';
			silencedUntil?: string | null;
			comment?: string;
			ownerId?: string | null;
		},
		labels: { title: string; verb: string }
	) => {
		// The query is built HERE, not from a memo — the rolling window must be the one
		// the user is looking at when they confirm, not the one from when they selected.
		const scope = allMatchingSelected ? { query: buildBulkScopeQuery() } : { ids: selectedAlerts.map((a) => a.id) };
		try {
			const result = await bulkAction.mutateAsync({ ...vars, ...scope });
			toast(
				result.failed > 0
					? {
							title: `Partial ${labels.title.toLowerCase()}`,
							description: `${labels.verb} ${result.succeeded} of ${result.matched} alerts, ${result.failed} failed`,
							variant: 'destructive',
						}
					: {
							title: labels.title,
							description: `${labels.verb} ${result.succeeded} alert${result.succeeded !== 1 ? 's' : ''}`,
						}
			);
		} catch (err) {
			toast({
				title: 'Bulk action failed',
				description: err instanceof Error ? err.message : 'Unknown error',
				variant: 'destructive',
			});
		}
		setSelectedAlerts([]);
		setAllMatchingSelected(false);
	};

	const handleSilenceAllSelected = (silencedUntil?: string | null, comment?: string) =>
		runBulkAction(
			{ action: 'silence', silencedUntil: silencedUntil ?? null, comment },
			{ title: 'Alerts silenced', verb: 'Silenced' }
		);

	const handleAssignOwnerAllSelected = (ownerId: string | null) =>
		runBulkAction(
			{ action: 'assignOwner', ownerId },
			{ title: ownerId ? 'Owner assigned' : 'Owner removed', verb: 'Updated owner on' }
		);

	const handleResolveAllSelected = (comment?: string) => {
		setSelectedAlert(null);
		return runBulkAction({ action: 'resolve', comment }, { title: 'Alerts resolved', verb: 'Resolved' });
	};

	// Permanent delete stays scoped to the LOADED selection on purpose: an irreversible
	// action must never apply to alerts the user hasn't at least had the chance to see.
	const handleDeleteAllSelected = async () => {
		setSelectedAlert(null);
		await handleDeleteForeverAll(selectedAlerts, () => handleSelectAlerts([]));
	};

	const handleDeleteResolvedAlert = async (alertId: string) => {
		try {
			await deleteResolvedAlertMutation.mutateAsync(alertId);
			toast({ title: 'Alert deleted', description: 'The alert was permanently removed.' });
		} catch (err) {
			toast({
				title: 'Failed to delete alert',
				description: err instanceof Error ? err.message : 'Unknown error',
				variant: 'destructive',
			});
		}
	};

	// Silence, resolve, and delete change alert state in one click from several places, so
	// each one funnels through a confirmation dialog before running.
	const confirmSilenceAlert = (alertId: string) =>
		setPendingAction({
			title: 'Silence this alert?',
			description:
				'The alert stays in the list but stops notifying for the chosen duration. You can unsilence it at any time, and silencing again restarts the timer.',
			confirmLabel: 'Silence',
			withSilenceDuration: true,
			withComment: true,
			commentLabel: 'Silence comment',
			commentPlaceholder: 'Why is this silenced?',
			run: (comment, silencedUntil) => void handleSilenceAlert(alertId, silencedUntil, comment),
		});

	const confirmResolveAlert = (alertId: string) =>
		setPendingAction({
			title: 'Resolve this alert?',
			description: 'The alert moves to the Resolved list. You can unresolve it later if it is still an issue.',
			confirmLabel: 'Resolve',
			withComment: true,
			commentLabel: 'Resolve comment',
			commentPlaceholder: 'What fixed it / why is this resolved?',
			run: (comment) => void handleDeleteAlert(alertId, comment),
		});

	const confirmDeleteResolvedAlert = (alertId: string) =>
		setPendingAction({
			title: 'Delete this alert permanently?',
			description:
				'The alert will be removed for good and will no longer appear in the Resolved list. This cannot be undone.',
			confirmLabel: 'Delete',
			destructive: true,
			run: () => void handleDeleteResolvedAlert(alertId),
		});

	// Combined "All" view: route to the delete confirmation for resolved rows, the resolve
	// confirmation for active ones.
	const confirmDeleteAnyAlert = (alertId: string) => {
		if (resolvedIds.has(alertId)) {
			confirmDeleteResolvedAlert(alertId);
		} else {
			confirmResolveAlert(alertId);
		}
	};

	// Direct (no confirmation dialog), matching the single-row unsilence: it's
	// non-destructive and instantly reversible by silencing again.
	const handleUnsilenceAllSelected = () =>
		void runBulkAction({ action: 'unsilence' }, { title: 'Alerts unsilenced', verb: 'Unsilenced' });

	// What the confirmation dialogs promise: the loaded selection's size, or — with "all
	// matching" armed — the server-counted total the user clicked, plus an explicit scope
	// note so "37 alerts" is never silently "37 you can see plus 3,000 you can't".
	const bulkCount = allMatchingSelected ? (bulkMatchCount ?? selectedAlerts.length) : selectedAlerts.length;
	const bulkScopeNote = allMatchingSelected
		? ' This applies to every alert matching the current filters, including ones not loaded into the list.'
		: '';

	// Gate for offering "Select all N matching": every VISIBLE row must be selected.
	// Membership, not a length comparison — a filter change keeps the old selection, so
	// a stale 10-row selection over a 3-row list must not read as "the page is selected".
	const allVisibleSelected = useMemo(() => {
		if (filteredAlerts.length === 0) return false;
		const selectedIds = new Set(selectedAlerts.map((a) => a.id));
		return filteredAlerts.every((a) => selectedIds.has(a.id));
	}, [filteredAlerts, selectedAlerts]);

	const confirmSilenceAllSelected = () =>
		setPendingAction({
			title: `Silence ${bulkCount} alert${bulkCount !== 1 ? 's' : ''}?`,
			description:
				'The selected alerts stay in the list but stop notifying for the chosen duration. You can unsilence them at any time, and silencing again restarts the timer. You take ownership of every silenced alert' +
				(allMatchingSelected ? ', and matches that are already silenced restart their timer.' : '.') +
				bulkScopeNote,
			confirmLabel: 'Silence all',
			withSilenceDuration: true,
			withComment: true,
			commentLabel: 'Silence comment',
			commentPlaceholder: 'Why are these silenced?',
			run: (comment, silencedUntil) => void handleSilenceAllSelected(silencedUntil, comment),
		});

	const handleCommentAllSelected = (comment: string) =>
		runBulkAction({ action: 'comment', comment }, { title: 'Comment added', verb: 'Commented on' });

	const confirmCommentAllSelected = () =>
		setPendingAction({
			title: `Comment on ${bulkCount} alert${bulkCount !== 1 ? 's' : ''}?`,
			description:
				'The same comment is added to every selected alert, visible in its comments and history.' +
				bulkScopeNote,
			confirmLabel: 'Comment',
			withComment: true,
			requireComment: true,
			commentLabel: 'Comment',
			commentPlaceholder: 'What should the team know about these alerts?',
			run: (comment) => {
				if (comment) void handleCommentAllSelected(comment);
			},
		});

	const confirmResolveAllSelected = () =>
		setPendingAction({
			title: `Resolve ${bulkCount} alert${bulkCount !== 1 ? 's' : ''}?`,
			description:
				'The selected alerts move to the Resolved list. You can unresolve them later if needed. An optional comment will be added to every resolved alert.' +
				bulkScopeNote,
			confirmLabel: 'Resolve',
			withComment: true,
			commentLabel: 'Resolve comment',
			commentPlaceholder: 'What fixed it / why is this resolved?',
			run: (comment) => void handleResolveAllSelected(comment),
		});

	// Next-page triggers per view; undefined when the loaded set is complete so the
	// table doesn't keep firing at the bottom of a fully-loaded list.
	const loadMoreActive = hasMoreActive ? () => void fetchMoreActive() : undefined;
	const loadMoreResolved = hasMoreResolved ? () => void fetchMoreResolved() : undefined;
	const loadMoreAll =
		hasMoreActive || hasMoreResolved
			? () => {
					if (hasMoreActive) void fetchMoreActive();
					if (hasMoreResolved) void fetchMoreResolved();
				}
			: undefined;

	// Loaded vs total for the current view — drives the select-all scope note (bulk
	// actions apply only to loaded rows). Equal in grouping mode, where everything loads.
	const loadedCount =
		activeTab === AlertTab.Active
			? alerts.length
			: activeTab === AlertTab.Resolved
				? resolvedAlerts.length
				: allAlerts.length;
	const matchTotal =
		activeTab === AlertTab.Active
			? activeTotal
			: activeTab === AlertTab.Resolved
				? resolvedTotal
				: activeTotal + resolvedTotal;
	const showPartialNotice = matchTotal > loadedCount;

	// Active-tab alerts table, parameterized by the alert list so it can render full-width
	// or inside one of the split-by-assignment panes without duplicating the prop wiring.
	const renderActiveAlertsTable = (list: Alert[]) => (
		<AlertsTable
			alerts={list}
			onEndReached={loadMoreActive}
			groupSummaryByKey={groupSummaryByKey}
			sortField={alertSort.field}
			sortDirection={alertSort.dir}
			onSortChange={(field, dir) => setAlertSort({ field, dir })}
			onSilenceAlert={confirmSilenceAlert}
			onUnsilenceAlert={handleUnsilenceAlert}
			onDeleteAlert={confirmResolveAlert}
			onSelectAlerts={handleSelectAlerts}
			selectedAlerts={selectedAlerts}
			isLoading={isLoading}
			visibleColumns={visibleColumns}
			columnOrder={columnOrder}
			onAlertClick={handleAlertClick}
			activeAlertId={syncedSelectedAlert?.id ?? null}
			tagKeyColumnLabels={allColumnLabels}
			groupByColumns={dashboardState.groupBy}
			onGroupByChange={(cols) => updateDashboardField('groupBy', cols)}
			onColumnToggle={handleColumnToggle}
			onColumnOrderChange={handleColumnOrderChange}
			tagKeys={tagKeys}
			timeRange={dashboardState.timeRange}
			onTimeRangeChange={(range) => updateDashboardField('timeRange', range)}
			searchTerm={dashboardState.query}
			onSearchTermChange={(term) => updateDashboardField('query', term)}
			renderToolbar={false}
			severityColors={severityColors}
			expandRows={expandRows}
		/>
	);

	const handleNewDashboard = () => {
		if (isDirty) {
			setPendingNavigation(() => resetDashboard);
			setShowUnsavedChangesDialog(true);
		} else {
			resetDashboard();
		}
	};

	const handleDashboardSelect = (dashboard: Dashboard) => {
		const loadDashboard = () => {
			setInitialState({
				id: dashboard.id,
				name: dashboard.name,
				type: dashboard.type,
				description: dashboard.description || '',
				visibleColumns: dashboard.visibleColumns || [],
				filters: dashboard.filters || {},
				columnOrder: dashboard.columnOrder || [],
				splitByAssignment: dashboard.splitByAssignment ?? false,
				// ?? not ||: a dashboard saved with severity colors explicitly OFF must stay
				// off, and only a dashboard with no opinion at all falls back to the legacy
				// per-browser preference.
				severityColors: dashboard.severityColors ?? readLegacySeverityColors(),
				groupBy: dashboard.groupBy || [],
				query: dashboard.query || '',
				timeRange: deserializeTimeRange(dashboard.timeRange),
			});
		};

		if (isDirty) {
			setPendingNavigation(() => loadDashboard);
			setShowUnsavedChangesDialog(true);
		} else {
			loadDashboard();
		}
	};

	const handleDeleteDashboard = async () => {
		if (!dashboardState.id) return;

		try {
			await deleteDashboardMutation.mutateAsync(dashboardState.id);
			resetDashboard();
			setShowDashboardSettings(false);
		} catch (error) {
			toast({
				title: 'Error deleting dashboard',
				description: 'Failed to delete dashboard',
				variant: 'destructive',
			});
		}
	};

	const handleAlertClick = (alert: Alert) => {
		// Opening an unread (active) alert marks it as read, un-bolding its row. The transient
		// isResolved flag (set on resolved rows in the All view) is the guard here — an id-based
		// check would wrongly skip active alerts that were resolved once and re-fired.
		if (alert.isRead === false && !alert.isResolved) {
			markAlertReadMutation.mutate(alert.id);
		}
		setSelectedAlert((prev) => (prev?.id === alert.id ? null : alert));
	};

	// Per-tab counts for the alert-list picker; the dropdown shows every tab's count so
	// switching isn't needed just to see how many resolved/all alerts there are. The
	// search term is applied too — AlertsTable filters by it after the sidebar/time
	// filters, and the counts must agree with the rows actually shown.
	// Counts come from the SERVER totals, not the loaded page — so a search matching 1,800
	// alerts reads "1,800", not "500". Each total already reflects that tab's filters,
	// search and time window. Caveat: the active query suspends the status filter (it's the
	// superset serving all three tabs), so with a status filter applied — e.g. silenced
	// hidden — the Active count is the pre-status total. It signals "more than loaded"
	// correctly; an exact status-aware count would need its own count query.
	const tabCounts: Record<AlertTab, number> = useMemo(
		() => ({
			[AlertTab.Active]: activeTotal,
			[AlertTab.Resolved]: resolvedTotal,
			[AlertTab.All]: activeTotal + resolvedTotal,
		}),
		[activeTotal, resolvedTotal]
	);
	return (
		<DashboardLayout>
			<div className="flex h-full">
				<FilterSidebar collapsed={filterPanelCollapsed} onToggle={toggleFilterPanelCollapsed}>
					<AlertsFilterPanel
						alerts={currentAlertData}
						serverFacets={
							activeTab === AlertTab.Active
								? activeFacets.data
								: activeTab === AlertTab.Resolved
									? resolvedFacets.data
									: mergeFacetsResponses(suspendedActiveFacets.data, resolvedFacets.data)
						}
						filters={dashboardState.filters}
						onFilterChange={handleFilterChange}
						collapsed={filterPanelCollapsed}
						tagKeys={tagKeys}
						hideStatusFilter={activeTab !== AlertTab.Active}
					/>
				</FilterSidebar>

				<div className="flex-1 flex min-h-0 overflow-hidden">
					<div className={cn('flex flex-col p-4 min-h-0 transition-all duration-300', 'flex-1 min-w-0')}>
						<div className="shrink-0 mb-4">
							<DashboardHeader
								dashboardName={dashboardState.name}
								onDashboardNameChange={(name) => updateDashboardField('name', name)}
								onDashboardNameBlur={() => {
									if (dashboardState.name && dashboardState.name !== initialState.name) {
										handleSaveDashboard();
									}
								}}
								isDirty={isDirty}
								onSave={handleSaveDashboard}
								onSettingsClick={() => setShowDashboardSettings(true)}
								isRefreshing={isRefreshing}
								lastRefresh={lastRefresh}
								onRefresh={handleManualRefresh}
								dashboards={dashboards}
								onDashboardSelect={handleDashboardSelect}
								onNewDashboard={handleNewDashboard}
								isDraft={!dashboardState.id}
							/>

							<div className="mt-3 flex items-center gap-4">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="outline"
											size="sm"
											className="gap-1.5 shrink-0"
											// Dynamic name: a static label would override the visible text and
											// hide the current view + count from screen readers.
											aria-label={`Choose which alerts to show — currently ${
												ALERT_TAB_OPTIONS.find((option) => option.value === activeTab)?.label ??
												'Active'
											}, ${tabCounts[activeTab]} alerts`}
										>
											{/* All options render stacked in one grid cell (hidden except the
											    current one) so the button keeps the width of the widest option
											    and nothing shifts when switching views. */}
											<span className="grid">
												{ALERT_TAB_OPTIONS.map(({ value, label, Icon }) => (
													<span
														key={value}
														aria-hidden={value !== activeTab}
														className={cn(
															'col-start-1 row-start-1 flex items-center gap-1.5 whitespace-nowrap',
															value !== activeTab && 'invisible'
														)}
													>
														<Icon className="h-4 w-4" />
														<span>{label}</span>
														<span className="text-xs text-muted-foreground tabular-nums">
															{tabCounts[value]}
														</span>
													</span>
												))}
											</span>
											<ChevronDown className="h-3.5 w-3.5 opacity-60" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" className="w-44">
										<DropdownMenuRadioGroup
											value={activeTab}
											onValueChange={(value) => {
												setActiveTab(value as AlertTab);
												setSelectedAlert(null);
												handleSelectAlerts([]);
											}}
										>
											{ALERT_TAB_OPTIONS.map(({ value, label, Icon }) => (
												<DropdownMenuRadioItem key={value} value={value} className="gap-1.5">
													<Icon className="h-4 w-4" />
													<span>{label}</span>
													<span className="ml-auto pl-4 text-xs text-muted-foreground tabular-nums">
														{tabCounts[value]}
													</span>
												</DropdownMenuRadioItem>
											))}
										</DropdownMenuRadioGroup>
									</DropdownMenuContent>
								</DropdownMenu>

								<div className="flex-1 min-w-0">
									<SearchBar
										searchTerm={dashboardState.query}
										onSearchChange={(term) => updateDashboardField('query', term)}
									/>
								</div>

								{/* Silenced alerts are usually filtered out (a dashboard's status filter
								    typically pins Firing), and digging into the sidebar to check what's
								    silenced is a lot of clicks for a routine question. Active-only: the
								    Resolved and All views suspend the status filter, so the button would
								    be inert there. */}
								{activeTab === AlertTab.Active && (
									<Button
										variant={silencedShown ? 'default' : 'outline'}
										size="sm"
										onClick={() => handleFilterChange(toggleSilencedAlerts(dashboardState.filters))}
										className="gap-1.5 shrink-0"
										title={silencedShown ? 'Hide silenced alerts' : 'Show silenced alerts'}
										aria-pressed={silencedShown}
									>
										<BellOff className="h-4 w-4" />
										<span className="hidden lg:inline">Silenced</span>
										{silencedCount > 0 && (
											<span className="text-[10px] font-semibold tabular-nums opacity-80">
												{silencedCount}
											</span>
										)}
									</Button>
								)}

								{activeTab === AlertTab.Active && (
									<Button
										variant={splitByAssignment ? 'default' : 'outline'}
										size="sm"
										onClick={() => updateDashboardField('splitByAssignment', !splitByAssignment)}
										className="gap-1.5 shrink-0"
										title="Split into Unassigned and Assigned"
									>
										<Columns2 className="h-4 w-4" />
										<span className="hidden lg:inline">Split by owner</span>
									</Button>
								)}

								<Button
									variant={severityColors ? 'default' : 'outline'}
									size="sm"
									onClick={() => updateDashboardField('severityColors', !severityColors)}
									className="gap-1.5 shrink-0"
									title="Color rows by severity"
								>
									<Palette className="h-4 w-4" />
									<span className="hidden lg:inline">Severity colors</span>
								</Button>

								<Button
									variant={expandRows ? 'default' : 'outline'}
									size="sm"
									onClick={toggleExpandRows}
									className="gap-1.5 shrink-0"
									title="Expand rows to show full content"
									aria-pressed={expandRows}
								>
									<WrapText className="h-4 w-4" />
									<span className="hidden lg:inline">Expand rows</span>
								</Button>

								<TimeFilter
									value={dashboardState.timeRange ?? createEmptyTimeRange()}
									onChange={(range) => updateDashboardField('timeRange', range)}
								/>
							</div>
						</div>

						{activeTab === AlertTab.Active ? (
							<>
								{splitByAssignment ? (
									<VerticalSplit
										className="flex-1"
										top={
											<AssignmentPane
												title="Unassigned"
												// Server-counted total over the full matching set — the
												// loaded page's split is a lie past 500 rows. Falls back
												// to the loaded count until the first response.
												count={unassignedTotal ?? unassignedAlerts.length}
												tone="amber"
												isEmpty={unassignedAlerts.length === 0 && !isLoading}
												emptyText="Nothing waiting — all alerts are assigned."
											>
												{renderActiveAlertsTable(unassignedAlerts)}
											</AssignmentPane>
										}
										bottom={
											<AssignmentPane
												title="Assigned"
												count={assignedTotal ?? assignedAlerts.length}
												tone="emerald"
												isEmpty={assignedAlerts.length === 0 && !isLoading}
												emptyText="No alerts assigned yet."
											>
												{renderActiveAlertsTable(assignedAlerts)}
											</AssignmentPane>
										}
									/>
								) : (
									<div
										className={cn(
											'flex-1 min-h-0',
											alerts.length === 0 && !isLoading && 'flex items-center justify-center'
										)}
									>
										{renderActiveAlertsTable(filteredAlerts)}
									</div>
								)}

								<div className="shrink-0">
									<AlertsSelectionBar
										selectedAlerts={selectedAlerts}
										hasUnloadedMatches={showPartialNotice && !allMatchingSelected}
										matchingTotal={bulkMatchCount}
										allMatchingSelected={allMatchingSelected}
										// Offered Gmail-style: every VISIBLE row is selected (membership,
										// not a length compare — a filter change can leave a stale larger
										// selection over a smaller list) and the server counts more
										// matching this exact view.
										onSelectAllMatching={
											!allMatchingSelected &&
											allVisibleSelected &&
											bulkMatchCount !== undefined &&
											bulkMatchCount > selectedAlerts.length
												? () => setAllMatchingSelected(true)
												: undefined
										}
										onClearSelection={() => handleSelectAlerts([])}
										onSilenceAll={confirmSilenceAllSelected}
										onUnsilenceAll={handleUnsilenceAllSelected}
										onAssignOwnerAll={handleAssignOwnerAllSelected}
										onResolveAll={confirmResolveAllSelected}
										onCommentAll={confirmCommentAllSelected}
										// Permanent delete never runs by-filter — it stays on the loaded
										// selection, so it's hidden while "all matching" is armed.
										onDeleteAll={allMatchingSelected ? undefined : handleDeleteAllSelected}
									/>
								</div>
							</>
						) : activeTab === AlertTab.Resolved ? (
							<div
								className={cn(
									'flex-1 min-h-0',
									// Matches the list the table actually renders, so the empty state
									// centers also when filters (not just an empty source) clear it.
									resolvedViewAlerts.length === 0 &&
										!isLoadingResolved &&
										'flex items-center justify-center'
								)}
							>
								<AlertsTable
									alerts={resolvedViewAlerts}
									onEndReached={loadMoreResolved}
									groupSummaryByKey={groupSummaryByKey}
									sortField={alertSort.field}
									sortDirection={alertSort.dir}
									onSortChange={(field, dir) => setAlertSort({ field, dir })}
									onSilenceAlert={undefined}
									onUnsilenceAlert={undefined}
									onDeleteAlert={confirmDeleteResolvedAlert}
									onUnresolveAlert={handleUnresolveAlert}
									onSelectAlerts={undefined}
									selectedAlerts={[]}
									isLoading={isLoadingResolved}
									isResolved={true}
									visibleColumns={visibleColumns}
									columnOrder={columnOrder}
									onAlertClick={handleAlertClick}
									activeAlertId={syncedSelectedAlert?.id ?? null}
									tagKeyColumnLabels={allColumnLabels}
									groupByColumns={dashboardState.groupBy}
									onGroupByChange={(cols) => updateDashboardField('groupBy', cols)}
									onColumnToggle={handleColumnToggle}
									onColumnOrderChange={handleColumnOrderChange}
									tagKeys={tagKeys}
									timeRange={dashboardState.timeRange}
									onTimeRangeChange={(range) => updateDashboardField('timeRange', range)}
									searchTerm={dashboardState.query}
									onSearchTermChange={(term) => updateDashboardField('query', term)}
									renderToolbar={false}
									severityColors={severityColors}
									expandRows={expandRows}
								/>
							</div>
						) : (
							<div
								className={cn(
									'flex-1 min-h-0',
									filteredAllAlerts.length === 0 &&
										!isLoading &&
										!isLoadingResolved &&
										'flex items-center justify-center'
								)}
							>
								<AlertsTable
									alerts={filteredAllAlerts}
									onEndReached={loadMoreAll}
									groupSummaryByKey={groupSummaryByKey}
									sortField={alertSort.field}
									sortDirection={alertSort.dir}
									onSortChange={(field, dir) => setAlertSort({ field, dir })}
									onSilenceAlert={confirmSilenceAlert}
									onUnsilenceAlert={handleUnsilenceAlert}
									onDeleteAlert={confirmDeleteAnyAlert}
									onUnresolveAlert={handleUnresolveAlert}
									onSelectAlerts={undefined}
									selectedAlerts={[]}
									isLoading={isLoading || isLoadingResolved}
									visibleColumns={visibleColumns}
									columnOrder={columnOrder}
									onAlertClick={handleAlertClick}
									activeAlertId={syncedSelectedAlert?.id ?? null}
									tagKeyColumnLabels={allColumnLabels}
									groupByColumns={dashboardState.groupBy}
									onGroupByChange={(cols) => updateDashboardField('groupBy', cols)}
									onColumnToggle={handleColumnToggle}
									onColumnOrderChange={handleColumnOrderChange}
									tagKeys={tagKeys}
									timeRange={dashboardState.timeRange}
									onTimeRangeChange={(range) => updateDashboardField('timeRange', range)}
									searchTerm={dashboardState.query}
									onSearchTermChange={(term) => updateDashboardField('query', term)}
									renderToolbar={false}
									severityColors={severityColors}
									expandRows={expandRows}
								/>
							</div>
						)}
					</div>

					{syncedSelectedAlert &&
						(() => {
							// Data-driven (not tab-driven): resolving an alert while its panel is
							// open flips the panel to resolved mode in place, and unresolving
							// flips it back.
							const selectedIsResolved = resolvedIds.has(syncedSelectedAlert.id);
							return (
								<AlertDetailsPanel
									alert={syncedSelectedAlert}
									isActive={!selectedIsResolved}
									timeRange={dashboardState.timeRange}
									onClose={() => setSelectedAlert(null)}
									onSilence={confirmSilenceAlert}
									onUnsilence={handleUnsilenceAlert}
									onDelete={selectedIsResolved ? confirmDeleteResolvedAlert : confirmResolveAlert}
									onUnresolve={handleUnresolveAlert}
								/>
							);
						})()}
				</div>
			</div>

			<ConfirmAlertActionDialog pending={pendingAction} onClose={() => setPendingAction(null)} />

			<DashboardSettingsDrawer
				open={showDashboardSettings}
				onOpenChange={setShowDashboardSettings}
				dashboardName={dashboardState.name}
				onDashboardNameChange={(name) => updateDashboardField('name', name)}
				dashboardDescription={dashboardState.description}
				onDashboardDescriptionChange={(desc) => updateDashboardField('description', desc)}
				onDelete={handleDeleteDashboard}
				canDelete={!!dashboardState.id}
			/>
		</DashboardLayout>
	);
};

export default Alerts;
