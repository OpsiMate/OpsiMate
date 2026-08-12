import { alertsApi, AlertQueryParams } from '@/lib/api';
import { AlertGroupSummaryNode } from '@OpsiMate/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '../queryKeys';

// Server-computed group counts + rollup status over the FULL matching set. Used when a
// grouped view is too large to load whole: rows page in progressively, but the group
// headers read these true totals — a header can never claim fewer alerts than exist.
export const useAlertGroupSummaries = (
	groupBy: string[],
	params: Omit<AlertQueryParams, 'limit' | 'cursor' | 'sort' | 'dir'>,
	options?: { resolved?: boolean; enabled?: boolean }
) => {
	const { data } = useQuery({
		queryKey: [
			...queryKeys.alerts,
			'groups',
			options?.resolved ? 'resolved' : 'active',
			groupBy,
			params.filters ?? null,
			params.from ?? null,
			params.to ?? null,
			params.search ?? null,
		],
		enabled: (options?.enabled ?? true) && groupBy.length > 0,
		queryFn: async () => {
			const response = await alertsApi.getAlertGroupSummaries(groupBy, params, options);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to fetch group summaries');
			}
			return response.data.groups;
		},
		staleTime: 10 * 1000,
		refetchInterval: 20 * 1000,
	});

	// Flattened for O(1) join onto rendered group headers by key.
	const byKey = useMemo(() => {
		if (!data) return undefined;
		const map = new Map<string, AlertGroupSummaryNode>();
		const walk = (nodes: AlertGroupSummaryNode[]) => {
			for (const node of nodes) {
				map.set(node.key, node);
				walk(node.children);
			}
		};
		walk(data);
		return map;
	}, [data]);

	return { groups: data, byKey };
};
