import { incidentsApi } from '@/lib/api';
import { isPlaygroundMode } from '@/lib/playground';
import { IncidentSummary } from '@OpsiMate/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '../queryKeys';

// All incidents with their roll-ups. Polled on the alerts cadence: folder rows render
// from this + the alerts list, and the two must not drift visibly apart. Disabled in
// playground mode — the mock engine has no incidents endpoint (yet).
export const useIncidents = () => {
	const playgroundMode = isPlaygroundMode();
	const result = useQuery({
		queryKey: queryKeys.incidents,
		queryFn: async (): Promise<IncidentSummary[]> => {
			const response = await incidentsApi.listIncidents();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch incidents');
			}
			return response.data ?? [];
		},
		enabled: !playgroundMode,
		staleTime: 5 * 1000,
		refetchInterval: 5 * 1000,
	});

	const incidents = useMemo(() => result.data ?? [], [result.data]);
	const incidentsById = useMemo(() => new Map(incidents.map((i) => [i.id, i])), [incidents]);

	return { incidents, incidentsById, isLoading: result.isLoading };
};
