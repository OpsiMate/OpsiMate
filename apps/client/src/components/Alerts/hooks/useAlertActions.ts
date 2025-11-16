import { useDeleteAlert, useDismissAlert, useUndismissAlert } from '@/hooks/queries/alerts';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@OpsiMate/shared';

export const useAlertActions = () => {
	const dismissAlertMutation = useDismissAlert();
	const undismissAlertMutation = useUndismissAlert();
	const deleteAlertMutation = useDeleteAlert();
	const { toast } = useToast();

	const handleDismissAlert = async (alertId: string) => {
		try {
			await dismissAlertMutation.mutateAsync(alertId);
		} catch (error) {
			toast({
				title: 'Error dismissing alert',
				description: 'Failed to dismiss alert',
				variant: 'destructive',
			});
		}
	};

	const handleUndismissAlert = async (alertId: string) => {
		try {
			await undismissAlertMutation.mutateAsync(alertId);
		} catch (error) {
			toast({
				title: 'Error undismissing alert',
				description: 'Failed to undismiss alert',
				variant: 'destructive',
			});
		}
	};

	const handleDeleteAlert = async (alertId: string) => {
		try {
			await deleteAlertMutation.mutateAsync(alertId);
			toast({
				title: 'Alert deleted',
				description: 'The alert has been permanently removed.',
			});
		} catch (error) {
			toast({
				title: 'Error deleting alert',
				description: 'Failed to delete alert',
				variant: 'destructive',
			});
		}
	};

	const handleDismissAll = async (selectedAlerts: Alert[], onComplete: () => void) => {
		for (const alert of selectedAlerts) {
			await handleDismissAlert(alert.id);
		}
		onComplete();
	};

	return {
		handleDismissAlert,
		handleUndismissAlert,
		handleDeleteAlert,
		handleDismissAll,
	};
};
