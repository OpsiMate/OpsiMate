import {
	useAddIncidentAlerts,
	useCreateIncident,
	useDeleteIncident,
	useIncidents,
	useRemoveIncidentAlerts,
	useUpdateIncident,
} from '@/hooks/queries/incidents';
import { useToast } from '@/hooks/use-toast';
import { pluralize } from '@/lib/text';
import { Alert } from '@OpsiMate/shared';
import { useRef, useState } from 'react';
import { IncidentDialogTarget, IncidentFormResult } from '../IncidentDialog';

interface UseIncidentActionsProps {
	// The current selection: what "group into / add to / remove from incident" acts on.
	selectedAlerts: Alert[];
	onSelectAlerts: (alerts: Alert[]) => void;
	// Every loaded alert (active + resolved), to find the incident a row belongs to.
	alertsById: Map<string, Alert>;
}

// The incident dialog: 'create' groups the current selection, a number edits that incident.
type IncidentDialogState = 'create' | number | null;

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Unknown error');

// Everything the alerts page does WITH incidents: the incidents query, the right-side
// incident panel's open/closed state, the one incident dialog (create / add / remove /
// edit) and its submit, plus the per-incident and per-member actions the table rows
// offer. The alerts page keeps only the wiring — which panel is exclusive with which,
// and when the selection bar may offer the dialog at all.
export const useIncidentActions = ({ selectedAlerts, onSelectAlerts, alertsById }: UseIncidentActionsProps) => {
	const { toast } = useToast();
	const { incidents, incidentsById, isLoading, isError } = useIncidents();
	const createIncidentMutation = useCreateIncident();
	const addIncidentAlertsMutation = useAddIncidentAlerts();
	const updateIncidentMutation = useUpdateIncident();
	const deleteIncidentMutation = useDeleteIncident();
	const removeIncidentAlertsMutation = useRemoveIncidentAlerts();

	// Incident whose details panel is open; null = alert details (or nothing) shown.
	const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
	const [dialog, setDialog] = useState<IncidentDialogState>(null);
	// Synchronous in-flight guard: a double submit before the mutation's isPending reaches
	// the dialog would send two requests, and the server re-homes exclusive memberships,
	// so the second could undo the first.
	const submitInFlight = useRef(false);
	// Bulk removal fans out to one request per incident, so the mutation's own isPending
	// cannot stand for the whole operation; this flag does.
	const [removalPending, setRemovalPending] = useState(false);

	// Clicking the open incident again closes it.
	const openIncidentPanel = (incidentId: number) =>
		setSelectedIncidentId((prev) => (prev === incidentId ? null : incidentId));
	const closeIncidentPanel = () => setSelectedIncidentId(null);
	const closeDialog = () => setDialog(null);
	// Close the create dialog after its action went through, without disturbing an edit
	// dialog the user may have opened meanwhile (and vice versa).
	const closeDialogIf = (state: IncidentDialogState) => setDialog((current) => (current === state ? null : current));

	const dialogTarget: IncidentDialogTarget | null =
		dialog === 'create'
			? {
					alerts: selectedAlerts,
					incidents,
					incidentsState: isError ? 'error' : isLoading ? 'loading' : 'ready',
				}
			: dialog != null && incidentsById.has(dialog)
				? { incident: incidentsById.get(dialog)! }
				: null;

	// The mutations paint the folder on the table before the server answers, so the dialog
	// closes and the selection clears on submit, like any other alert action. A refusal
	// rolls the table back, says so, and hands the selection back for a retry. (Edit is
	// the exception: its dialog holds typed text, so it stays open until the server
	// accepts — the folder itself is already renamed optimistically.)
	const createIncident = async (name: string, description: string) => {
		const alerts = selectedAlerts;
		closeDialogIf('create');
		onSelectAlerts([]);
		try {
			const incident = await createIncidentMutation.mutateAsync({
				name: name || undefined,
				description: description || undefined,
				alerts,
			});
			toast({ title: 'Incident created', description: incident.name });
		} catch (err) {
			toast({ title: 'Failed to create incident', description: errorMessage(err), variant: 'destructive' });
			onSelectAlerts(alerts);
		}
	};

	const addSelectionToIncident = async (incidentId: number) => {
		const incident = incidentsById.get(incidentId);
		const alerts = selectedAlerts;
		closeDialogIf('create');
		onSelectAlerts([]);
		try {
			await addIncidentAlertsMutation.mutateAsync({ id: incidentId, alerts });
			toast({ title: 'Added to incident', description: incident?.name ?? `#${incidentId}` });
		} catch (err) {
			toast({ title: 'Failed to add to incident', description: errorMessage(err), variant: 'destructive' });
			onSelectAlerts(alerts);
		}
	};

	// Bulk "Remove from incident": the selection may span several incidents, and the
	// endpoint is per incident, so group the members by theirs. Alerts in no incident are
	// left alone.
	const removeSelectionFromIncidents = async () => {
		const byIncident = new Map<number, Alert[]>();
		for (const alert of selectedAlerts) {
			if (alert.incidentId == null) continue;
			byIncident.set(alert.incidentId, [...(byIncident.get(alert.incidentId) ?? []), alert]);
		}
		if (byIncident.size === 0) return;
		const selection = selectedAlerts;
		closeDialogIf('create');
		onSelectAlerts([]);
		setRemovalPending(true);
		try {
			// Settled, not all-or-nothing: each incident's removal stands on its own. Alerts
			// whose removal went through leave the selection; the failed groups come back
			// selected so a retry targets exactly them.
			const groups = [...byIncident];
			const outcomes = await Promise.allSettled(
				groups.map(([id, alerts]) => removeIncidentAlertsMutation.mutateAsync({ id, alerts }))
			);
			const removedIds = new Set<string>();
			let dissolved = 0;
			const failures: string[] = [];
			outcomes.forEach((outcome, i) => {
				const [id, alerts] = groups[i];
				if (outcome.status === 'fulfilled') {
					alerts.forEach((alert) => removedIds.add(alert.id));
					if (outcome.value.dissolved) dissolved += 1;
				} else {
					failures.push(incidentsById.get(id)?.name ?? `#${id}`);
				}
			});
			if (removedIds.size > 0) {
				toast({
					title: 'Removed from incident',
					description:
						`${removedIds.size} ${pluralize(removedIds.size, 'alert')} removed` +
						(dissolved > 0 ? `; ${dissolved} ${pluralize(dissolved, 'incident')} dissolved` : ''),
				});
			}
			if (failures.length > 0) {
				toast({
					title: 'Failed to remove from incident',
					description: `Could not remove from ${failures.join(', ')}; those alerts stay selected.`,
					variant: 'destructive',
				});
			}
			if (failures.length > 0) {
				onSelectAlerts(selection.filter((alert) => !removedIds.has(alert.id)));
			}
		} finally {
			setRemovalPending(false);
		}
	};

	const saveIncident = async (id: number, name: string, description: string) => {
		try {
			await updateIncidentMutation.mutateAsync({ id, name, description: description || null });
			toast({ title: 'Incident updated', description: name });
			closeDialogIf(id);
		} catch (err) {
			toast({ title: 'Failed to update incident', description: errorMessage(err), variant: 'destructive' });
		}
	};

	const handleDialogSubmit = async (result: IncidentFormResult) => {
		if (submitInFlight.current) return;
		submitInFlight.current = true;
		try {
			if (result.kind === 'create') await createIncident(result.name, result.description);
			else if (result.kind === 'add') await addSelectionToIncident(result.incidentId);
			else if (result.kind === 'remove') await removeSelectionFromIncidents();
			else if (typeof dialog === 'number') await saveIncident(dialog, result.name, result.description);
		} finally {
			submitInFlight.current = false;
		}
	};

	const ungroupIncident = async (incidentId: number) => {
		const incident = incidentsById.get(incidentId);
		try {
			await deleteIncidentMutation.mutateAsync(incidentId);
			toast({ title: 'Incident ungrouped', description: incident?.name ?? `#${incidentId}` });
			if (selectedIncidentId === incidentId) closeIncidentPanel();
		} catch (err) {
			toast({ title: 'Failed to ungroup incident', description: errorMessage(err), variant: 'destructive' });
		}
	};

	// One member row's "Remove from incident".
	const removeAlertFromIncident = async (alertId: string) => {
		const alert = alertsById.get(alertId);
		const incidentId = alert?.incidentId;
		if (!alert || incidentId == null) return;
		try {
			const result = await removeIncidentAlertsMutation.mutateAsync({ id: incidentId, alerts: [alert] });
			toast({
				title: result.dissolved ? 'Incident dissolved' : 'Removed from incident',
				description: result.dissolved ? 'Its last member was removed' : undefined,
			});
			if (result.dissolved && selectedIncidentId === incidentId) closeIncidentPanel();
		} catch (err) {
			toast({ title: 'Failed to remove from incident', description: errorMessage(err), variant: 'destructive' });
		}
	};

	return {
		incidents,
		incidentsById,
		// The open panel's incident, or null (also while the list has not loaded it yet).
		selectedIncident: selectedIncidentId != null ? (incidentsById.get(selectedIncidentId) ?? null) : null,
		selectedIncidentId,
		openIncidentPanel,
		closeIncidentPanel,
		openDialog: (target: 'create' | number) => setDialog(target),
		closeDialog,
		dialogTarget,
		handleDialogSubmit,
		isSubmitting:
			createIncidentMutation.isPending ||
			addIncidentAlertsMutation.isPending ||
			updateIncidentMutation.isPending ||
			removalPending,
		ungroupIncident,
		removeAlertFromIncident,
	};
};
