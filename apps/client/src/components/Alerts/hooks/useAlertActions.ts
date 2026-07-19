import {
	useDeleteAlert,
	useDeleteResolvedAlert,
	useSilenceAlert,
	useSetAlertOwner,
	useUnresolveAlert,
	useUnsilenceAlert,
} from '@/hooks/queries/alerts';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@OpsiMate/shared';

export const useAlertActions = () => {
	const silenceAlertMutation = useSilenceAlert();
	const unsilenceAlertMutation = useUnsilenceAlert();
	const deleteAlertMutation = useDeleteAlert();
	const setAlertOwnerMutation = useSetAlertOwner();
	const deleteResolvedAlertMutation = useDeleteResolvedAlert();
	const unresolveAlertMutation = useUnresolveAlert();
	const { toast } = useToast();

	const handleSilenceAlert = async (alertId: string) => {
		try {
			await silenceAlertMutation.mutateAsync(alertId);
		} catch (error) {
			toast({
				title: 'Error silencing alert',
				description: 'Failed to silence alert',
				variant: 'destructive',
			});
		}
	};

	const handleUnsilenceAlert = async (alertId: string) => {
		try {
			await unsilenceAlertMutation.mutateAsync(alertId);
		} catch (error) {
			toast({
				title: 'Error unsilenceing alert',
				description: 'Failed to unsilence alert',
				variant: 'destructive',
			});
		}
	};

	// Deleting an active alert IS resolving it (permanent delete only exists for resolved
	// alerts), so the feedback speaks in resolve terms.
	const handleDeleteAlert = async (alertId: string, comment?: string) => {
		try {
			await deleteAlertMutation.mutateAsync({ alertId, comment });
			toast({
				title: 'Alert resolved',
				description: 'The alert was moved to Resolved.',
			});
		} catch {
			toast({
				title: 'Error resolving alert',
				description: 'Failed to resolve alert',
				variant: 'destructive',
			});
		}
	};

	const handleUnresolveAlert = async (alertId: string) => {
		try {
			await unresolveAlertMutation.mutateAsync(alertId);
			toast({
				title: 'Alert unresolved',
				description: 'The alert was moved back to firing.',
			});
		} catch {
			toast({
				title: 'Error unresolving alert',
				description: 'Failed to move the alert back to firing',
				variant: 'destructive',
			});
		}
	};

	const handleSilenceAll = async (selectedAlerts: Alert[], onComplete: () => void) => {
		const silencePromises = selectedAlerts.map((alert) => handleSilenceAlert(alert.id));
		const results = await Promise.allSettled(silencePromises);

		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				const alert = selectedAlerts[index];
				// Silently handle failed silencings
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

	// Bulk-resolve the selected active alerts (active "delete" == resolve).
	const handleResolveAll = async (selectedAlerts: Alert[], onComplete: () => void, comment?: string) => {
		const results = await Promise.allSettled(
			selectedAlerts.map((alert) => deleteAlertMutation.mutateAsync({ alertId: alert.id, comment }))
		);
		const successCount = results.filter((r) => r.status === 'fulfilled').length;
		const failCount = results.length - successCount;
		toast(
			failCount > 0
				? {
						title: 'Partial resolve',
						description: `Resolved ${successCount} alerts, ${failCount} failed`,
						variant: 'destructive',
					}
				: {
						title: 'Alerts resolved',
						description: `Moved ${successCount} alert${successCount !== 1 ? 's' : ''} to Resolved`,
					}
		);
		onComplete();
	};

	// Permanently delete the selected active alerts: resolve each one, then remove it from
	// the resolve (permanent delete only exists for resolved alerts).
	const handleDeleteForeverAll = async (selectedAlerts: Alert[], onComplete: () => void) => {
		const results = await Promise.allSettled(
			selectedAlerts.map(async (alert) => {
				await deleteAlertMutation.mutateAsync({ alertId: alert.id });
				await deleteResolvedAlertMutation.mutateAsync(alert.id);
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
		handleSilenceAlert,
		handleUnsilenceAlert,
		handleDeleteAlert,
		handleUnresolveAlert,
		handleSilenceAll,
		handleAssignOwnerAll,
		handleResolveAll,
		handleDeleteForeverAll,
	};
};
