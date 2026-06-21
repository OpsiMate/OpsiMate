import {
	useDeleteAlert,
	useDeleteArchivedAlert,
	useDismissAlert,
	useSetAlertOwner,
	useUndismissAlert,
} from '@/hooks/queries/alerts';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@OpsiMate/shared';

export const useAlertActions = () => {
	const dismissAlertMutation = useDismissAlert();
	const undismissAlertMutation = useUndismissAlert();
	const deleteAlertMutation = useDeleteAlert();
	const setAlertOwnerMutation = useSetAlertOwner();
	const deleteArchivedAlertMutation = useDeleteArchivedAlert();
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
		const dismissPromises = selectedAlerts.map((alert) => handleDismissAlert(alert.id));
		const results = await Promise.allSettled(dismissPromises);

		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				const alert = selectedAlerts[index];
				// Silently handle failed dismissals
				void alert;
				void result;
			}
		});

		onComplete();
	};

	const handleAssignOwnerAll = async (selectedAlerts: Alert[], ownerId: string | null, onComplete: () => void) => {
		const assignPromises = selectedAlerts.map((alert) =>
			setAlertOwnerMutation.mutateAsync({ alertId: alert.id, ownerId })
		);
		const results = await Promise.allSettled(assignPromises);

		const successCount = results.filter((r) => r.status === 'fulfilled').length;
		const failCount = results.filter((r) => r.status === 'rejected').length;

		if (failCount > 0) {
			toast({
				title: 'Partial assignment',
				description: `Assigned ${successCount} alerts, ${failCount} failed`,
				variant: 'destructive',
			});
		} else {
			toast({
				title: 'Owner assigned',
				description: `Successfully assigned ${successCount} alert${successCount !== 1 ? 's' : ''}`,
			});
		}

		onComplete();
	};

	// Bulk-archive the selected active alerts (active "delete" == archive).
	const handleArchiveAll = async (selectedAlerts: Alert[], onComplete: () => void) => {
		const results = await Promise.allSettled(
			selectedAlerts.map((alert) => deleteAlertMutation.mutateAsync(alert.id))
		);
		const successCount = results.filter((r) => r.status === 'fulfilled').length;
		const failCount = results.length - successCount;
		toast(
			failCount > 0
				? {
						title: 'Partial archive',
						description: `Archived ${successCount} alerts, ${failCount} failed`,
						variant: 'destructive',
					}
				: {
						title: 'Alerts archived',
						description: `Moved ${successCount} alert${successCount !== 1 ? 's' : ''} to archive`,
					}
		);
		onComplete();
	};

	// Permanently delete the selected active alerts: archive each one, then remove it from
	// the archive (permanent delete only exists for archived alerts).
	const handleDeleteForeverAll = async (selectedAlerts: Alert[], onComplete: () => void) => {
		const results = await Promise.allSettled(
			selectedAlerts.map(async (alert) => {
				await deleteAlertMutation.mutateAsync(alert.id);
				await deleteArchivedAlertMutation.mutateAsync(alert.id);
			})
		);
		const successCount = results.filter((r) => r.status === 'fulfilled').length;
		const failCount = results.length - successCount;
		toast(
			failCount > 0
				? {
						title: 'Partial delete',
						description: `Deleted ${successCount} alerts, ${failCount} failed`,
						variant: 'destructive',
					}
				: {
						title: 'Alerts deleted',
						description: `Permanently deleted ${successCount} alert${successCount !== 1 ? 's' : ''}`,
					}
		);
		onComplete();
	};

	return {
		handleDismissAlert,
		handleUndismissAlert,
		handleDeleteAlert,
		handleDismissAll,
		handleAssignOwnerAll,
		handleArchiveAll,
		handleDeleteForeverAll,
	};
};
