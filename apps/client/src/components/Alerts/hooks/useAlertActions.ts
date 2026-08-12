import {
	useDeleteAlert,
	useDeleteResolvedAlert,
	useSilenceAlert,
	useUnresolveAlert,
	useUnsilenceAlert,
} from '@/hooks/queries/alerts';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@OpsiMate/shared';

// Single-alert actions plus the one bulk action that stays client-fanned (permanent
// delete). Every other bulk action goes through useBulkAlertAction — one server request
// over ids or over every alert matching a query.
export const useAlertActions = () => {
	const silenceAlertMutation = useSilenceAlert();
	const unsilenceAlertMutation = useUnsilenceAlert();
	const deleteAlertMutation = useDeleteAlert();
	const deleteResolvedAlertMutation = useDeleteResolvedAlert();
	const unresolveAlertMutation = useUnresolveAlert();
	const { toast } = useToast();

	const handleSilenceAlert = async (alertId: string, silencedUntil?: string | null, comment?: string) => {
		try {
			await silenceAlertMutation.mutateAsync({ alertId, silencedUntil, comment });
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
		handleDeleteForeverAll,
	};
};
