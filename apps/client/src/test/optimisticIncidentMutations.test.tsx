import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act, ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Alert, AlertSeverity, AlertStatus, IncidentSummary } from '@OpsiMate/shared';
import {
	useAddIncidentAlerts,
	useCreateIncident,
	useDeleteIncident,
	useRemoveIncidentAlerts,
	useUpdateIncident,
} from '@/hooks/queries/incidents/useIncidentMutations';
import { summarizeMembers } from '@/hooks/queries/incidents/incidentCache';
import { updateAlertInCache } from '@/hooks/queries/alerts/alertListCache';

const createIncident = vi.fn();
const addIncidentAlerts = vi.fn();
const removeIncidentAlerts = vi.fn();
const deleteIncident = vi.fn();
const updateIncident = vi.fn();
vi.mock('@/lib/api', () => ({
	incidentsApi: {
		createIncident: (payload: unknown) => createIncident(payload),
		addIncidentAlerts: (id: number, alertIds: string[]) => addIncidentAlerts(id, alertIds),
		removeIncidentAlerts: (id: number, alertIds: string[]) => removeIncidentAlerts(id, alertIds),
		deleteIncident: (id: number) => deleteIncident(id),
		updateIncident: (id: number, payload: unknown) => updateIncident(id, payload),
	},
}));
vi.mock('@/lib/auth', () => ({ getCurrentUser: () => ({ id: 7 }) }));

// A folder row needs the incidentId stamp on the alert rows AND a summary under that id
// in the incidents list. Before these, the incident mutations only invalidated, so the
// folder appeared after the POST plus two refetches — while every other alert action
// paints on click. These pin that both caches change before the server answers, that
// the provisional id is swapped for the real one on success, and that a refusal rolls
// everything back.

interface AlertsPage {
	alerts: Alert[];
	total?: number;
}

interface InfiniteAlerts {
	pages: AlertsPage[];
	pageParams: string[];
}

interface WrapperProps {
	children: ReactNode;
}

interface Pending {
	release: (value: unknown) => void;
	fail: (reason: unknown) => void;
}

interface AlertOverrides {
	incidentId?: number;
	ownerId?: string | null;
	status?: AlertStatus;
	severity?: AlertSeverity;
	isSilenced?: boolean;
	startsAt?: string;
	updatedAt?: string;
}

const alert = (id: string, overrides: AlertOverrides = {}): Alert =>
	({
		id,
		status: AlertStatus.FIRING,
		severity: AlertSeverity.WARNING,
		isSilenced: false,
		startsAt: '2026-11-02T10:00:00.000Z',
		updatedAt: '2026-11-02T10:00:00.000Z',
		...overrides,
	}) as Alert;

const incident = (id: number, alertIds: string[], overrides: Partial<IncidentSummary> = {}): IncidentSummary => ({
	id,
	name: `Incident #${id}`,
	description: null,
	createdBy: 1,
	createdAt: '2026-11-02T09:00:00.000Z',
	updatedAt: '2026-11-02T09:00:00.000Z',
	ownerName: 'Someone',
	alertCount: alertIds.length,
	firingCount: alertIds.length,
	silencedCount: 0,
	resolvedCount: 0,
	worstSeverity: AlertSeverity.WARNING,
	earliestStartsAt: '2026-11-02T10:00:00.000Z',
	latestUpdatedAt: '2026-11-02T10:00:00.000Z',
	alertIds,
	...overrides,
});

const activeListKey = ['alerts', 'api', { sort: 'startsAt' }] as const;
const otherActiveListKey = ['alerts', 'api', { sort: 'severity' }] as const;
const resolvedListKey = ['resolvedAlerts', { sort: 'startsAt' }] as const;
const incidentsKey = ['incidents'] as const;

// a1 and a2 are free; a3 is the only member of incident 1; r1 (resolved) is in incident 2
// with a4.
const seed = (): QueryClient => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const list = (): InfiniteAlerts => ({
		pages: [
			{
				alerts: [alert('a1'), alert('a2', { severity: AlertSeverity.CRITICAL, ownerId: 'someone-else' })],
				total: 4,
			},
			{ alerts: [alert('a3', { incidentId: 1 }), alert('a4', { incidentId: 2 })], total: 4 },
		],
		pageParams: ['', 'cursor-1'],
	});
	queryClient.setQueryData(activeListKey, list());
	queryClient.setQueryData(otherActiveListKey, list());
	queryClient.setQueryData(resolvedListKey, {
		pages: [{ alerts: [alert('r1', { incidentId: 2, status: AlertStatus.RESOLVED })], total: 1 }],
		pageParams: [''],
	});
	queryClient.setQueryData(incidentsKey, [
		incident(1, ['a3']),
		incident(2, ['a4', 'r1'], { alertCount: 2, firingCount: 1, resolvedCount: 1 }),
	]);
	return queryClient;
};

const wrapperFor =
	(queryClient: QueryClient) =>
	({ children }: WrapperProps) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

const hold = (mock: ReturnType<typeof vi.fn>): Pending => {
	const pending: Pending = { release: () => {}, fail: () => {} };
	mock.mockImplementation(
		() =>
			new Promise((resolve, reject) => {
				pending.release = resolve;
				pending.fail = reject;
			})
	);
	return pending;
};

const alertsIn = (queryClient: QueryClient, key: readonly unknown[]): Alert[] =>
	queryClient.getQueryData<InfiniteAlerts>(key)?.pages.flatMap((page) => page.alerts) ?? [];
const stampOf = (queryClient: QueryClient, key: readonly unknown[], id: string): number | undefined =>
	alertsIn(queryClient, key).find((a) => a.id === id)?.incidentId;
const ownerOf = (queryClient: QueryClient, key: readonly unknown[], id: string): string | null | undefined =>
	alertsIn(queryClient, key).find((a) => a.id === id)?.ownerId;
const incidentsIn = (queryClient: QueryClient): IncidentSummary[] =>
	queryClient.getQueryData<IncidentSummary[]>(incidentsKey) ?? [];
const incidentIn = (queryClient: QueryClient, id: number): IncidentSummary | undefined =>
	incidentsIn(queryClient).find((i) => i.id === id);

beforeEach(() => {
	for (const mock of [createIncident, addIncidentAlerts, removeIncidentAlerts, deleteIncident, updateIncident]) {
		mock.mockReset();
	}
});

describe('summarizeMembers', () => {
	test('mirrors the server roll-ups: firing excludes silenced, resolved is the rest, worst severity wins', () => {
		const rollups = summarizeMembers([
			alert('a', { severity: AlertSeverity.INFO, startsAt: '2026-11-02T08:00:00.000Z' }),
			alert('b', { severity: AlertSeverity.CRITICAL, isSilenced: true, updatedAt: '2026-11-02T12:00:00.000Z' }),
			alert('c', { status: AlertStatus.RESOLVED }),
		]);
		expect(rollups).toEqual({
			alertCount: 3,
			firingCount: 1,
			silencedCount: 1,
			resolvedCount: 1,
			worstSeverity: AlertSeverity.CRITICAL,
			earliestStartsAt: '2026-11-02T08:00:00.000Z',
			latestUpdatedAt: '2026-11-02T12:00:00.000Z',
			alertIds: ['a', 'b', 'c'],
		});
	});
});

describe('useCreateIncident', () => {
	test('the folder is foldable before the server answers: stamped rows plus a provisional summary', async () => {
		const queryClient = seed();
		const pending = hold(createIncident);
		const { result } = renderHook(() => useCreateIncident(), { wrapper: wrapperFor(queryClient) });
		const members = [alert('a1'), alert('a2', { severity: AlertSeverity.CRITICAL, ownerId: 'someone-else' })];

		act(() => result.current.mutate({ name: 'DB meltdown', alerts: members }));

		await waitFor(() => expect(stampOf(queryClient, activeListKey, 'a1')).toBeDefined());
		const provisionalId = stampOf(queryClient, activeListKey, 'a1')!;
		expect(provisionalId).toBeLessThan(0);
		expect(stampOf(queryClient, activeListKey, 'a2')).toBe(provisionalId);
		expect(stampOf(queryClient, otherActiveListKey, 'a2')).toBe(provisionalId);
		expect(stampOf(queryClient, activeListKey, 'a3')).toBe(1);
		// The creator claims the unowned members, so in split-by-owner the folder sits in
		// the Assigned pane from the first paint; a2's existing owner is kept.
		expect(ownerOf(queryClient, activeListKey, 'a1')).toBe('7');
		expect(ownerOf(queryClient, otherActiveListKey, 'a1')).toBe('7');
		expect(ownerOf(queryClient, activeListKey, 'a2')).toBe('someone-else');

		const provisional = incidentIn(queryClient, provisionalId);
		expect(provisional).toMatchObject({
			name: 'DB meltdown',
			createdBy: 7,
			alertCount: 2,
			firingCount: 2,
			worstSeverity: AlertSeverity.CRITICAL,
			alertIds: ['a1', 'a2'],
		});
		expect(createIncident).toHaveBeenCalledWith({
			name: 'DB meltdown',
			description: undefined,
			alertIds: ['a1', 'a2'],
		});

		// The server's answer replaces the provisional id everywhere, in one step.
		const created = incident(42, ['a1', 'a2'], { name: 'DB meltdown', ownerName: 'Me' });
		act(() => pending.release({ success: true, data: created }));
		await waitFor(() => expect(stampOf(queryClient, activeListKey, 'a1')).toBe(42));
		expect(stampOf(queryClient, otherActiveListKey, 'a2')).toBe(42);
		expect(ownerOf(queryClient, activeListKey, 'a1')).toBe('7');
		expect(incidentIn(queryClient, provisionalId)).toBeUndefined();
		expect(incidentIn(queryClient, 42)).toEqual(created);
		queryClient.clear();
	});

	test('grouping re-homes members: the incident they leave shrinks, and dissolves when emptied', async () => {
		const queryClient = seed();
		hold(createIncident);
		const { result } = renderHook(() => useCreateIncident(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate({ alerts: [alert('a3', { incidentId: 1 }), alert('a4', { incidentId: 2 })] }));

		await waitFor(() => expect(stampOf(queryClient, activeListKey, 'a3')).toBeLessThan(0));
		expect(incidentIn(queryClient, 1)).toBeUndefined();
		expect(incidentIn(queryClient, 2)).toMatchObject({
			alertCount: 1,
			firingCount: 0,
			resolvedCount: 1,
			alertIds: ['r1'],
		});
		expect(incidentsIn(queryClient).find((i) => i.id < 0)?.name).toBe('New incident');
		queryClient.clear();
	});

	test('a refused create rolls both caches back', async () => {
		const queryClient = seed();
		const before = incidentsIn(queryClient);
		const pending = hold(createIncident);
		const { result } = renderHook(() => useCreateIncident(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate({ alerts: [alert('a1'), alert('a2')] }));
		await waitFor(() => expect(stampOf(queryClient, activeListKey, 'a1')).toBeDefined());

		act(() => pending.fail(new Error('nope')));
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(stampOf(queryClient, activeListKey, 'a1')).toBeUndefined();
		expect(stampOf(queryClient, otherActiveListKey, 'a2')).toBeUndefined();
		expect(incidentsIn(queryClient)).toEqual(before);
		queryClient.clear();
	});
});

describe('useAddIncidentAlerts', () => {
	test('adding an alert to the incident it is already in leaves it intact, and claims it too', async () => {
		const queryClient = seed();
		hold(addIncidentAlerts);
		const { result } = renderHook(() => useAddIncidentAlerts(), { wrapper: wrapperFor(queryClient) });

		// a3 is the sole (unowned) member of incident 1; a1 is free.
		act(() => result.current.mutate({ id: 1, alerts: [alert('a3', { incidentId: 1 }), alert('a1')] }));

		await waitFor(() => expect(stampOf(queryClient, activeListKey, 'a1')).toBe(1));
		expect(incidentIn(queryClient, 1)).toMatchObject({ alertCount: 2, alertIds: ['a3', 'a1'] });
		// The server claims every alert in the request, the existing member included.
		expect(ownerOf(queryClient, activeListKey, 'a3')).toBe('1');
		expect(ownerOf(queryClient, activeListKey, 'a1')).toBe('1');
		queryClient.clear();
	});

	test('the target grows and the source shrinks before the server answers', async () => {
		const queryClient = seed();
		hold(addIncidentAlerts);
		const { result } = renderHook(() => useAddIncidentAlerts(), { wrapper: wrapperFor(queryClient) });

		act(() =>
			result.current.mutate({
				id: 2,
				alerts: [alert('a2', { severity: AlertSeverity.CRITICAL }), alert('a3', { incidentId: 1 })],
			})
		);

		await waitFor(() => expect(stampOf(queryClient, activeListKey, 'a2')).toBe(2));
		expect(stampOf(queryClient, activeListKey, 'a3')).toBe(2);
		// Unowned newcomers go to the incident's owner (createdBy 1), owned ones keep theirs.
		expect(ownerOf(queryClient, activeListKey, 'a3')).toBe('1');
		expect(ownerOf(queryClient, activeListKey, 'a2')).toBe('someone-else');
		expect(incidentIn(queryClient, 1)).toBeUndefined();
		expect(incidentIn(queryClient, 2)).toMatchObject({
			alertCount: 4,
			firingCount: 3,
			resolvedCount: 1,
			worstSeverity: AlertSeverity.CRITICAL,
			alertIds: ['a4', 'r1', 'a2', 'a3'],
		});
		expect(addIncidentAlerts).toHaveBeenCalledWith(2, ['a2', 'a3']);
		queryClient.clear();
	});
});

describe('useRemoveIncidentAlerts', () => {
	test('removed members unfold at once, across active and resolved lists', async () => {
		const queryClient = seed();
		hold(removeIncidentAlerts);
		const { result } = renderHook(() => useRemoveIncidentAlerts(), { wrapper: wrapperFor(queryClient) });

		act(() =>
			result.current.mutate({ id: 2, alerts: [alert('r1', { incidentId: 2, status: AlertStatus.RESOLVED })] })
		);

		await waitFor(() => expect(stampOf(queryClient, resolvedListKey, 'r1')).toBeUndefined());
		expect(incidentIn(queryClient, 2)).toMatchObject({
			alertCount: 1,
			firingCount: 1,
			resolvedCount: 0,
			alertIds: ['a4'],
		});
		queryClient.clear();
	});

	test('a failed removal puts back only its own incident, not the other groups of a bulk removal', async () => {
		const queryClient = seed();
		const failing = hold(removeIncidentAlerts);
		const { result } = renderHook(() => useRemoveIncidentAlerts(), { wrapper: wrapperFor(queryClient) });

		// Group 1 (incident 1, a3) will be refused; group 2 (incident 2, a4) is accepted.
		act(() => result.current.mutate({ id: 1, alerts: [alert('a3', { incidentId: 1 })] }));
		await waitFor(() => expect(incidentIn(queryClient, 1)).toBeUndefined());
		const accepting = hold(removeIncidentAlerts);
		act(() => result.current.mutate({ id: 2, alerts: [alert('a4', { incidentId: 2 })] }));
		await waitFor(() => expect(stampOf(queryClient, activeListKey, 'a4')).toBeUndefined());
		act(() => accepting.release({ success: true, data: { dissolved: false } }));

		act(() => failing.fail(new Error('nope')));
		await waitFor(() => expect(stampOf(queryClient, activeListKey, 'a3')).toBe(1));
		expect(incidentIn(queryClient, 1)).toMatchObject({ alertIds: ['a3'] });
		// Group 2's removal stands.
		expect(stampOf(queryClient, activeListKey, 'a4')).toBeUndefined();
		expect(incidentIn(queryClient, 2)).toMatchObject({ alertCount: 1, alertIds: ['r1'] });
		queryClient.clear();
	});

	test('removing the last member dissolves the incident', async () => {
		const queryClient = seed();
		hold(removeIncidentAlerts);
		const { result } = renderHook(() => useRemoveIncidentAlerts(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate({ id: 1, alerts: [alert('a3', { incidentId: 1 })] }));

		await waitFor(() => expect(stampOf(queryClient, activeListKey, 'a3')).toBeUndefined());
		expect(incidentIn(queryClient, 1)).toBeUndefined();
		queryClient.clear();
	});
});

describe('useDeleteIncident', () => {
	test('ungrouping drops the summary and unstamps every member it listed', async () => {
		const queryClient = seed();
		hold(deleteIncident);
		const { result } = renderHook(() => useDeleteIncident(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate(2));

		await waitFor(() => expect(incidentIn(queryClient, 2)).toBeUndefined());
		expect(stampOf(queryClient, activeListKey, 'a4')).toBeUndefined();
		expect(stampOf(queryClient, resolvedListKey, 'r1')).toBeUndefined();
		expect(stampOf(queryClient, activeListKey, 'a3')).toBe(1);
		queryClient.clear();
	});
});

describe('an incidents list that has not loaded', () => {
	test('is not written, while the alert rows are still stamped', async () => {
		const queryClient = seed();
		queryClient.removeQueries({ queryKey: incidentsKey });
		hold(createIncident);
		const { result } = renderHook(() => useCreateIncident(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate({ alerts: [alert('a1'), alert('a2')] }));

		await waitFor(() => expect(stampOf(queryClient, activeListKey, 'a1')).toBeLessThan(0));
		expect(queryClient.getQueryData(incidentsKey)).toBeUndefined();
		queryClient.clear();
	});
});

describe('useUpdateIncident', () => {
	test('a rename takes no alert-list snapshot, so its rollback cannot undo an alert change made meanwhile', async () => {
		const queryClient = seed();
		const pending = hold(updateIncident);
		const { result } = renderHook(() => useUpdateIncident(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate({ id: 1, name: 'Renamed' }));
		await waitFor(() => expect(incidentIn(queryClient, 1)?.name).toBe('Renamed'));
		// An owner assign lands while the rename is in flight.
		queryClient.setQueryData(
			activeListKey,
			updateAlertInCache('a1', (a) => ({ ...a, ownerId: '7' }))
		);

		act(() => pending.fail(new Error('nope')));
		await waitFor(() => expect(incidentIn(queryClient, 1)?.name).toBe('Incident #1'));
		expect(alertsIn(queryClient, activeListKey).find((a) => a.id === 'a1')?.ownerId).toBe('7');
		queryClient.clear();
	});

	test('a rename shows on the folder before the server answers and rolls back if refused', async () => {
		const queryClient = seed();
		const pending = hold(updateIncident);
		const { result } = renderHook(() => useUpdateIncident(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate({ id: 1, name: 'Renamed', description: null }));

		await waitFor(() => expect(incidentIn(queryClient, 1)?.name).toBe('Renamed'));
		act(() => pending.fail(new Error('nope')));
		await waitFor(() => expect(incidentIn(queryClient, 1)?.name).toBe('Incident #1'));
		queryClient.clear();
	});
});
