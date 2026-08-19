import { CreateIncidentPayload, incidentsApi, UpdateIncidentPayload } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

// Every membership change alters BOTH the incidents list and the incidentId stamped on
// alerts, so each mutation invalidates the two together.
const useInvalidateIncidentData = () => {
	const queryClient = useQueryClient();
	return () => {
		void queryClient.invalidateQueries({ queryKey: queryKeys.incidents });
		void queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		void queryClient.invalidateQueries({ queryKey: queryKeys.resolvedAlerts });
	};
};

interface ApiEnvelope<T> {
	success: boolean;
	data?: T;
	error?: string;
}

interface UpdateIncidentVariables extends UpdateIncidentPayload {
	id: number;
}

interface IncidentAlertsVariables {
	id: number;
	alertIds: string[];
}

const unwrap = <T>(response: ApiEnvelope<T>, fallback: string): T => {
	if (!response.success) throw new Error(response.error || fallback);
	return response.data as T;
};

export const useCreateIncident = () => {
	const invalidate = useInvalidateIncidentData();
	return useMutation({
		mutationFn: async (payload: CreateIncidentPayload) =>
			unwrap(await incidentsApi.createIncident(payload), 'Failed to create incident'),
		onSuccess: invalidate,
	});
};

export const useUpdateIncident = () => {
	const invalidate = useInvalidateIncidentData();
	return useMutation({
		mutationFn: async ({ id, ...payload }: UpdateIncidentVariables) =>
			unwrap(await incidentsApi.updateIncident(id, payload), 'Failed to update incident'),
		onSuccess: invalidate,
	});
};

export const useAddIncidentAlerts = () => {
	const invalidate = useInvalidateIncidentData();
	return useMutation({
		mutationFn: async ({ id, alertIds }: IncidentAlertsVariables) =>
			unwrap(await incidentsApi.addIncidentAlerts(id, alertIds), 'Failed to add alerts to incident'),
		onSuccess: invalidate,
	});
};

export const useRemoveIncidentAlerts = () => {
	const invalidate = useInvalidateIncidentData();
	return useMutation({
		mutationFn: async ({ id, alertIds }: IncidentAlertsVariables) =>
			unwrap(await incidentsApi.removeIncidentAlerts(id, alertIds), 'Failed to remove alerts from incident'),
		onSuccess: invalidate,
	});
};

export const useDeleteIncident = () => {
	const invalidate = useInvalidateIncidentData();
	return useMutation({
		mutationFn: async (id: number) => {
			const response = await incidentsApi.deleteIncident(id);
			if (!response.success) throw new Error(response.error || 'Failed to ungroup incident');
		},
		onSuccess: invalidate,
	});
};
