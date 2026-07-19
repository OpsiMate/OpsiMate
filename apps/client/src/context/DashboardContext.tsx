import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearStorage, loadFromStorage, saveToStorage, serializeTimeRange } from './DashboardContext.utils';

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
			currentQuery !== initialQuery ||
			currentTimeRange !== initialTimeRange
		);
	}, [dashboardState, initialState, hasUserMadeChanges]);

	const updateDashboardField = useCallback(<K extends keyof DashboardState>(field: K, value: DashboardState[K]) => {
		const userEditableFields: (keyof DashboardState)[] = [
			'name',
			'description',
			'groupBy',
			'filters',
			'visibleColumns',
			'query',
			'timeRange',
		];
		if (userEditableFields.includes(field)) {
			setHasUserMadeChanges(true);
		}
		setDashboardState((prev) => ({ ...prev, [field]: value }));
	}, []);

	const resetDashboard = useCallback(() => {
		setDashboardState(defaultState);
		setInitialStateState(defaultState);
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
