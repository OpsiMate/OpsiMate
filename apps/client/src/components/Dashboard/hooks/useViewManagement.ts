import { useDeleteView, useSaveView } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { SavedView } from '@/types/SavedView';
import { Logger } from '@OpsiMate/shared';
import { useCallback } from 'react';
import { ColumnVisibility } from '../Dashboard.types';

const logger = new Logger('useViewManagement');

interface ViewManagementResult {
	handleSaveView: (view: SavedView) => Promise<void>;
	handleDeleteView: (viewId: string) => Promise<void>;
	handleApplyView: (
		view: SavedView,
		applyFilters: (view: SavedView) => void,
		setVisibleColumns: React.Dispatch<React.SetStateAction<ColumnVisibility>>,
		setActiveView: (viewId: string | undefined) => Promise<void>
	) => Promise<void>;
}

interface UseViewManagementProps {
	activeViewId: string | undefined;
	setActiveView: (viewId: string | undefined) => Promise<void>;
}

export const useViewManagement = ({ activeViewId, setActiveView }: UseViewManagementProps): ViewManagementResult => {
	const { toast } = useToast();
	const saveViewMutation = useSaveView();
	const deleteViewMutation = useDeleteView();

	const handleSaveView = useCallback(
		async (view: SavedView) => {
			try {
				await saveViewMutation.mutateAsync(view);
				await setActiveView(view.id);
			} catch (error) {
				logger.error('Error saving view:', error);
				throw error;
			}
		},
		[saveViewMutation, setActiveView]
	);

	const handleDeleteView = useCallback(
		async (viewId: string) => {
			try {
				await deleteViewMutation.mutateAsync(viewId);

				if (activeViewId === viewId) {
					await setActiveView(undefined);
				}

				toast({
					title: 'View Deleted',
					description: 'The saved view has been deleted.',
				});
			} catch (error) {
				logger.error('Error deleting view:', error);
				toast({
					title: 'Error',
					description: 'Failed to delete view',
					variant: 'destructive',
				});
			}
		},
		[activeViewId, deleteViewMutation, setActiveView, toast]
	);

	const handleApplyView = useCallback(
		async (
			view: SavedView,
			applyFilters: (view: SavedView) => void,
			setVisibleColumns: React.Dispatch<React.SetStateAction<ColumnVisibility>>,
			setActiveView: (viewId: string | undefined) => Promise<void>
		) => {
			try {
				applyFilters(view);
				setVisibleColumns((prev) => ({
					...prev,
					...view.visibleColumns,
				}));
				await setActiveView(view.id);

				if (view.name !== 'All Services') {
					toast({
						title: 'View Applied',
						description: `"${view.name}" view has been applied.`,
					});
				}
			} catch (error) {
				logger.error('Error applying view:', error);
				toast({
					title: 'Error',
					description: 'Failed to apply view',
					variant: 'destructive',
				});
			}
		},
		[toast]
	);

	return {
		handleSaveView,
		handleDeleteView,
		handleApplyView,
	};
};
