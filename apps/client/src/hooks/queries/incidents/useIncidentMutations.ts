import { incidentsApi } from '@/lib/api';
import { Alert, IncidentSummary, UpdateIncidentPayload } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import {
	applyIncidentChange,
	IncidentCacheSnapshot,
	nextProvisionalIncidentId,
	provisionalIncident,
	restoreIncidentCaches,
	rewriteIncidentCaches,
	withMembers,
	withoutMembers,
} from './incidentCache';

// Every membership change alters BOTH the incidents list and the incidentId stamped on
// alerts. Each mutation paints its change on the caches when it starts (onMutate), so the
// folder row moves on click the way an owner badge does; puts the caches back if the
// server refuses (onError); and once settled refetches the two together, which also
// corrects the roll-ups the client cannot predict (see incidentCache).
const useSettleIncidentData = () => {
	const queryClient = useQueryClient();
	return () => {
		void queryClient.invalidateQueries({ queryKey: queryKeys.incidents });
		void queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		void queryClient.invalidateQueries({ queryKey: queryKeys.resolvedAlerts });
		// Membership changes write per-alert history events; an OPEN alert panel (or
		// incident panel) must show them without being reopened.
		void queryClient.invalidateQueries({ queryKey: queryKeys.alertHistoryAll });
	};
};

interface ApiEnvelope<T> {
	success: boolean;
	data?: T;
	error?: string;
}

// The alerts themselves, not just their ids: the optimistic summary is built from them.
export interface CreateIncidentVariables {
	name?: string;
	description?: string;
	alerts: Alert[];
}

export interface IncidentAlertsVariables {
	id: number;
	alerts: Alert[];
}

interface UpdateIncidentVariables extends UpdateIncidentPayload {
	id: number;
}

interface IncidentMutationContext {
	snapshot: IncidentCacheSnapshot;
}

interface CreateIncidentContext extends IncidentMutationContext {
	provisionalId: number;
}

// Bulk removal fans out to one mutation per incident, in parallel, so a failed one
// must not restore a whole-cache snapshot — that would undo the other incidents'
// removals, confirmed or not. It puts back only its own incident's summary.
interface RemoveIncidentContext {
	previous: IncidentSummary | undefined;
}

const unwrap = <T>(response: ApiEnvelope<T>, fallback: string): T => {
	if (!response.success) throw new Error(response.error || fallback);
	return response.data as T;
};

const idsOf = (alerts: Alert[]): ReadonlySet<string> => new Set(alerts.map((alert) => alert.id));

export const useCreateIncident = () => {
	const queryClient = useQueryClient();
	const settle = useSettleIncidentData();
	return useMutation({
		mutationFn: async ({ name, description, alerts }: CreateIncidentVariables) =>
			unwrap(
				await incidentsApi.createIncident({ name, description, alertIds: alerts.map((alert) => alert.id) }),
				'Failed to create incident'
			),
		onMutate: async ({ name, description, alerts }): Promise<CreateIncidentContext> => {
			const provisionalId = nextProvisionalIncidentId();
			const incident = provisionalIncident(queryClient, provisionalId, {
				name: name || 'New incident',
				description: description || null,
				alerts,
			});
			// Members leave whatever incident they were in (the server re-homes them).
			const snapshot = await applyIncidentChange(queryClient, idsOf(alerts), provisionalId, (list) => [
				...withoutMembers(list, alerts),
				incident,
			]);
			return { snapshot, provisionalId };
		},
		onSuccess: (created: IncidentSummary, { alerts }, { provisionalId }) => {
			// Swap the provisional id for the real one before the refetches land, so the
			// folder never unfolds while the alerts list and the incidents list arrive in
			// either order.
			rewriteIncidentCaches(queryClient, idsOf(alerts), created.id, (list) =>
				list.map((incident) => (incident.id === provisionalId ? created : incident))
			);
		},
		onError: (_err, _variables, context) => restoreIncidentCaches(queryClient, context?.snapshot),
		onSettled: settle,
	});
};

export const useUpdateIncident = () => {
	const queryClient = useQueryClient();
	const settle = useSettleIncidentData();
	return useMutation({
		mutationFn: async ({ id, ...payload }: UpdateIncidentVariables) =>
			unwrap(await incidentsApi.updateIncident(id, payload), 'Failed to update incident'),
		onMutate: async ({ id, name, description }): Promise<IncidentMutationContext> => ({
			snapshot: await applyIncidentChange(queryClient, new Set(), undefined, (list) =>
				list.map((incident) =>
					incident.id === id
						? {
								...incident,
								name: name ?? incident.name,
								description: description === undefined ? incident.description : description,
							}
						: incident
				)
			),
		}),
		onError: (_err, _variables, context) => restoreIncidentCaches(queryClient, context?.snapshot),
		onSettled: settle,
	});
};

export const useAddIncidentAlerts = () => {
	const queryClient = useQueryClient();
	const settle = useSettleIncidentData();
	return useMutation({
		mutationFn: async ({ id, alerts }: IncidentAlertsVariables) =>
			unwrap(
				await incidentsApi.addIncidentAlerts(
					id,
					alerts.map((alert) => alert.id)
				),
				'Failed to add alerts to incident'
			),
		onMutate: async ({ id, alerts }): Promise<IncidentMutationContext> => {
			// An alert already in the target stays put: taking it out first would
			// dissolve a sole-member incident the moment it is "added" to itself.
			const joining = alerts.filter((alert) => alert.incidentId !== id);
			return {
				snapshot: await applyIncidentChange(queryClient, idsOf(joining), id, (list) =>
					withMembers(withoutMembers(list, joining), id, joining)
				),
			};
		},
		onError: (_err, _variables, context) => restoreIncidentCaches(queryClient, context?.snapshot),
		onSettled: settle,
	});
};

export const useRemoveIncidentAlerts = () => {
	const queryClient = useQueryClient();
	const settle = useSettleIncidentData();
	return useMutation({
		mutationFn: async ({ id, alerts }: IncidentAlertsVariables) =>
			unwrap(
				await incidentsApi.removeIncidentAlerts(
					id,
					alerts.map((alert) => alert.id)
				),
				'Failed to remove alerts from incident'
			),
		onMutate: async ({ id, alerts }): Promise<RemoveIncidentContext> => {
			// Removal is by the incident the caller names, whatever the rows say.
			const members = alerts.map((alert) => ({ ...alert, incidentId: id }));
			const previous = queryClient
				.getQueryData<IncidentSummary[]>(queryKeys.incidents)
				?.find((incident) => incident.id === id);
			await applyIncidentChange(queryClient, idsOf(alerts), undefined, (list) => withoutMembers(list, members));
			return { previous };
		},
		onError: (_err, { id, alerts }, context) => {
			const previous = context?.previous;
			if (!previous) return;
			rewriteIncidentCaches(queryClient, idsOf(alerts), id, (list) =>
				list.some((incident) => incident.id === id)
					? list.map((incident) => (incident.id === id ? previous : incident))
					: [...list, previous]
			);
		},
		onSettled: settle,
	});
};

export const useDeleteIncident = () => {
	const queryClient = useQueryClient();
	const settle = useSettleIncidentData();
	return useMutation({
		mutationFn: async (id: number) => {
			const response = await incidentsApi.deleteIncident(id);
			if (!response.success) throw new Error(response.error || 'Failed to ungroup incident');
		},
		onMutate: async (id): Promise<IncidentMutationContext> => {
			const members = queryClient
				.getQueryData<IncidentSummary[]>(queryKeys.incidents)
				?.find((incident) => incident.id === id)?.alertIds;
			return {
				snapshot: await applyIncidentChange(queryClient, new Set(members ?? []), undefined, (list) =>
					list.filter((incident) => incident.id !== id)
				),
			};
		},
		onError: (_err, _variables, context) => restoreIncidentCaches(queryClient, context?.snapshot),
		onSettled: settle,
	});
};
