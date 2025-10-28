import { SavedViewsManager } from '@/components/SavedViewsManager';
import { TVModeLauncher } from '@/components/TVModeLauncher';
import { SavedView } from '@/types/SavedView';
import { ColumnVisibility } from '../Dashboard.types';

interface DashboardHeaderProps {
	currentFilters: Record<string, string[]>;
	currentVisibleColumns: ColumnVisibility;
	currentSearchTerm: string;
	savedViews: SavedView[];
	onSaveView: (view: SavedView) => Promise<void>;
	onDeleteView: (viewId: string) => Promise<void>;
	onLoadView: (view: SavedView) => Promise<void>;
	activeViewId: string | undefined;
}

export const DashboardHeader = ({
	currentFilters,
	currentVisibleColumns,
	currentSearchTerm,
	savedViews,
	onSaveView,
	onDeleteView,
	onLoadView,
	activeViewId,
}: DashboardHeaderProps) => {
	return (
		<div className="flex justify-between items-center mb-2">
			<SavedViewsManager
				currentFilters={currentFilters}
				currentVisibleColumns={currentVisibleColumns}
				currentSearchTerm={currentSearchTerm}
				savedViews={savedViews}
				onSaveView={onSaveView}
				onDeleteView={onDeleteView}
				onLoadView={onLoadView}
				activeViewId={activeViewId}
			/>
			<TVModeLauncher
				currentFilters={currentFilters}
				currentVisibleColumns={currentVisibleColumns}
				currentSearchTerm={currentSearchTerm}
				activeViewId={activeViewId}
			/>
		</div>
	);
};
