import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearStorage, loadFromStorage, saveToStorage } from './DashboardContext.utils';

export type DashboardType = 'services' | 'alerts';

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
		setInitialStateState(JSON.parse(JSON.stringify(state)));
		setDashboardState(JSON.parse(JSON.stringify(state)));
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

		return (
			currentName !== initialName ||
			currentDescription !== initialDescription ||
			currentGroupBy !== initialGroupBy ||
			currentFilters !== initialFilters
		);
	}, [dashboardState, initialState, hasUserMadeChanges]);

	const updateDashboardField = useCallback(<K extends keyof DashboardState>(field: K, value: DashboardState[K]) => {
		const userEditableFields: (keyof DashboardState)[] = ['name', 'description', 'groupBy', 'filters'];
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
		setInitialStateState(JSON.parse(JSON.stringify(dashboardState)));
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
