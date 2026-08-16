import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
	clearStorage,
	createFreshState,
	loadFromStorage,
	saveToStorage,
	serializeTimeRange,
} from './DashboardContext.utils';

export type DashboardType = 'services' | 'alerts';

export type QuickPreset =
	| 'last1m'
	| 'last5m'
	| 'last15m'
	| 'last30m'
	| 'last1h'
	| 'last2h'
	| 'last6h'
	| 'last12h'
	| 'last24h'
	| 'today'
	| 'last2d'
	| 'last3d'
	| 'last5d'
	| 'last7d';

export interface TimeRange {
	from: Date | null;
	to: Date | null;
	preset: QuickPreset | 'custom' | null;
}

export interface DashboardState {
	id: string | null;
	name: string;
	type: DashboardType;
	description: string;
	visibleColumns: string[];
	filters: Record<string, string[]>;
	columnOrder: string[];
	// Manually-resized column widths (px by column id); empty means every column
	// keeps automatic sizing. A manual width wins until the user resets it.
	columnWidths: Record<string, number>;
	// Alerts toolbar toggles. Definite booleans here (the toolbar needs an on/off), unlike
	// the API's optional fields — the "never configured" case is resolved when a dashboard
	// is loaded or a draft is read from storage, not carried through the UI.
	splitByAssignment: boolean;
	severityColors: boolean;
	groupBy: string[];
	query: string;
	timeRange: TimeRange;
}

interface DashboardContextType {
	dashboardState: DashboardState;
	setDashboardState: React.Dispatch<React.SetStateAction<DashboardState>>;
	isDirty: boolean;
	initialState: DashboardState;
	setInitialState: (state: DashboardState) => void;
	updateDashboardField: <K extends keyof DashboardState>(field: K, value: DashboardState[K]) => void;
	resetDashboard: () => void;
	markAsClean: () => void;
	showUnsavedChangesDialog: boolean;
	setShowUnsavedChangesDialog: (show: boolean) => void;
	pendingNavigation: (() => void) | null;
	setPendingNavigation: (fn: (() => void) | null) => void;
	confirmNavigation: () => void;
	cancelNavigation: () => void;
}

const defaultState: DashboardState = {
	id: null,
	name: '',
	type: 'alerts',
	description: '',
	visibleColumns: [],
	filters: {},
	columnOrder: [],
	columnWidths: {},
	splitByAssignment: false,
	severityColors: false,
	groupBy: [],
	query: '',
	timeRange: { from: null, to: null, preset: null },
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
	const [dashboardState, setDashboardState] = useState<DashboardState>(() => loadFromStorage(defaultState));
	const [initialState, setInitialStateState] = useState<DashboardState>(() => loadFromStorage(defaultState));
	const [hasUserMadeChanges, setHasUserMadeChanges] = useState(false);
	const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
	const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
	const isDirtyRef = useRef(false);

	useEffect(() => {
		saveToStorage(dashboardState);
	}, [dashboardState]);

	const setInitialState = useCallback((state: DashboardState) => {
		// structuredClone (not JSON round-trip) so timeRange's Date objects survive
		// the deep copy — JSON.stringify would turn them into strings and break the
		// time filter comparisons in useAlertsFiltering.
		setInitialStateState(structuredClone(state));
		setDashboardState(structuredClone(state));
		setHasUserMadeChanges(false);
	}, []);

	const isDirty = useMemo(() => {
		if (!hasUserMadeChanges) {
			return false;
		}
		const currentName = dashboardState.name;
		const initialName = initialState.name;
		const currentDescription = dashboardState.description;
		const initialDescription = initialState.description;
		const currentGroupBy = JSON.stringify(dashboardState.groupBy);
		const initialGroupBy = JSON.stringify(initialState.groupBy);
		const currentFilters = JSON.stringify(dashboardState.filters);
		const initialFilters = JSON.stringify(initialState.filters);
		const currentVisibleColumns = JSON.stringify(dashboardState.visibleColumns);
		const initialVisibleColumns = JSON.stringify(initialState.visibleColumns);
		const currentColumnOrder = JSON.stringify(dashboardState.columnOrder);
		const initialColumnOrder = JSON.stringify(initialState.columnOrder);
		const currentColumnWidths = JSON.stringify(dashboardState.columnWidths);
		const initialColumnWidths = JSON.stringify(initialState.columnWidths);
		const currentQuery = dashboardState.query;
		const initialQuery = initialState.query;
		// serializeTimeRange fixes the property order (and turns Dates into ISO
		// strings), so the stringified comparison is stable.
		const currentTimeRange = JSON.stringify(serializeTimeRange(dashboardState.timeRange));
		const initialTimeRange = JSON.stringify(serializeTimeRange(initialState.timeRange));

		return (
			currentName !== initialName ||
			currentDescription !== initialDescription ||
			currentGroupBy !== initialGroupBy ||
			currentFilters !== initialFilters ||
			currentVisibleColumns !== initialVisibleColumns ||
			currentColumnOrder !== initialColumnOrder ||
			currentColumnWidths !== initialColumnWidths ||
			currentQuery !== initialQuery ||
			currentTimeRange !== initialTimeRange ||
			dashboardState.splitByAssignment !== initialState.splitByAssignment ||
			dashboardState.severityColors !== initialState.severityColors
		);
	}, [dashboardState, initialState, hasUserMadeChanges]);

	const updateDashboardField = useCallback(<K extends keyof DashboardState>(field: K, value: DashboardState[K]) => {
		const userEditableFields: (keyof DashboardState)[] = [
			'name',
			'description',
			'groupBy',
			'filters',
			'visibleColumns',
			'columnOrder',
			'columnWidths',
			'query',
			'timeRange',
			'splitByAssignment',
			'severityColors',
		];
		if (userEditableFields.includes(field)) {
			setHasUserMadeChanges(true);
		}
		setDashboardState((prev) => ({ ...prev, [field]: value }));
	}, []);

	const resetDashboard = useCallback(() => {
		// Same fresh-draft state a first visit gets, so starting a new dashboard doesn't
		// drop the legacy severity-colors preference that startup honours. One object for
		// both slots keeps them equal, so the new dashboard isn't born dirty.
		const fresh = createFreshState(defaultState);
		setDashboardState(fresh);
		setInitialStateState(fresh);
		setHasUserMadeChanges(false);
		clearStorage();
	}, []);

	const markAsClean = useCallback(() => {
		setInitialStateState(structuredClone(dashboardState));
		setHasUserMadeChanges(false);
	}, [dashboardState]);

	const confirmNavigation = useCallback(() => {
		if (pendingNavigation) {
			setHasUserMadeChanges(false);
			pendingNavigation();
			setPendingNavigation(null);
		}
		setShowUnsavedChangesDialog(false);
	}, [pendingNavigation]);

	const cancelNavigation = useCallback(() => {
		setPendingNavigation(null);
		setShowUnsavedChangesDialog(false);
	}, []);

	return (
		<DashboardContext.Provider
			value={{
				dashboardState,
				setDashboardState,
				isDirty,
				initialState,
				setInitialState,
				updateDashboardField,
				resetDashboard,
				markAsClean,
				showUnsavedChangesDialog,
				setShowUnsavedChangesDialog,
				pendingNavigation,
				setPendingNavigation,
				confirmNavigation,
				cancelNavigation,
			}}
		>
			{children}
		</DashboardContext.Provider>
	);
};

export const useDashboard = () => {
	const context = useContext(DashboardContext);
	if (context === undefined) {
		throw new Error('useDashboard must be used within a DashboardProvider');
	}
	return context;
};
