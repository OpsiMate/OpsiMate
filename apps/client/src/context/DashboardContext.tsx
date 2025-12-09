import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export interface DashboardState {
	id: string | null;
	name: string;
	description: string;
	visibleColumns: string[];
	activeFilters: Record<string, string[]>;
	archivedFilters: Record<string, string[]>;
	columnOrder: string[];
	groupByColumns: string[];
}

interface DashboardContextType {
	dashboardState: DashboardState;
	setDashboardState: React.Dispatch<React.SetStateAction<DashboardState>>;
	isDirty: boolean;
	setIsDirty: (isDirty: boolean) => void;
	initialState: DashboardState;
	setInitialState: (state: DashboardState) => void;
	updateDashboardField: <K extends keyof DashboardState>(field: K, value: DashboardState[K]) => void;
    resetDashboard: () => void;
}

const defaultState: DashboardState = {
	id: null,
	name: '',
	description: '',
	visibleColumns: [],
	activeFilters: {},
	archivedFilters: {},
	columnOrder: [],
	groupByColumns: [],
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
	const [dashboardState, setDashboardState] = useState<DashboardState>(defaultState);
	const [initialState, setInitialStateState] = useState<DashboardState>(defaultState);
	// We calculate isDirty derived from state vs initial state, but sometimes we need to force it or manage it?
    // Actually, deriving it is safer.

    const setInitialState = (state: DashboardState) => {
        setInitialStateState(JSON.parse(JSON.stringify(state)));
        setDashboardState(JSON.parse(JSON.stringify(state)));
    }

	const isDirty = useMemo(() => {
		return JSON.stringify(dashboardState) !== JSON.stringify(initialState);
	}, [dashboardState, initialState]);

	const updateDashboardField = <K extends keyof DashboardState>(field: K, value: DashboardState[K]) => {
		setDashboardState((prev) => ({ ...prev, [field]: value }));
	};

    const resetDashboard = () => {
        setDashboardState(defaultState);
        setInitialStateState(defaultState);
    }

    // Mock loading from local storage or API could happen here or in the consuming components
    // For now, we just provide the state container.

	return (
		<DashboardContext.Provider
			value={{
				dashboardState,
				setDashboardState,
				isDirty,
				setIsDirty: () => {}, // No-op since we derive it, but keeping interface if we change strategy
				initialState,
				setInitialState,
				updateDashboardField,
                resetDashboard
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
