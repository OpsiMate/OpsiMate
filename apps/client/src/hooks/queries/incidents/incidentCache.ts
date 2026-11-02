import { getCurrentUser } from '@/lib/auth';
import { Alert, AlertStatus, IncidentSummary, SEVERITY_RANK, User, getAlertSeverity } from '@OpsiMate/shared';
import { QueryClient } from '@tanstack/react-query';
import {
	AlertCacheSnapshot,
	applyToAlertCaches,
	restoreAlertCaches,
	updateAlertsInCache,
} from '../alerts/alertListCache';
import { queryKeys } from '../queryKeys';

// Optimistic updates for incidents. A folder row needs two things in the cache: the
// alert's incidentId stamp (the alerts lists) and a summary under that id (the incidents
// list). The alert mutations paint their change on click and let the refetch confirm it;
// these helpers give incidents the same treatment, so grouping, adding, removing and
// ungrouping all show in the table before the server answers, instead of after a POST
// plus two refetches.

// The roll-ups the server derives over an incident's members (see SUMMARY_SELECT in
// the incident repository), computed over the alert rows the client holds.
type MemberRollups = Pick<
	IncidentSummary,
	| 'alertCount'
	| 'firingCount'
	| 'silencedCount'
	| 'resolvedCount'
	| 'worstSeverity'
	| 'earliestStartsAt'
	| 'latestUpdatedAt'
	| 'alertIds'
>;

interface ProvisionalIncidentInput {
	name: string;
	description: string | null;
	alerts: Alert[];
}

// Everything the optimistic step changed, for onError to put back.
export interface IncidentCacheSnapshot {
	incidents: IncidentSummary[] | undefined;
	alerts: AlertCacheSnapshot;
	resolvedAlerts: AlertCacheSnapshot;
}

const isActive = (alert: Alert): boolean => alert.status !== AlertStatus.RESOLVED;

const worseOf = (a: IncidentSummary['worstSeverity'], b: IncidentSummary['worstSeverity']) => {
	if (!a) return b;
	if (!b) return a;
	return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a;
};
const earlierOf = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const laterOf = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

export const summarizeMembers = (alerts: Alert[]): MemberRollups => {
	const active = alerts.filter(isActive);
	const silenced = active.filter((alert) => alert.isSilenced);
	return {
		alertCount: alerts.length,
		firingCount: active.length - silenced.length,
		silencedCount: silenced.length,
		resolvedCount: alerts.length - active.length,
		worstSeverity: alerts.reduce<IncidentSummary['worstSeverity']>(
			(worst, alert) => worseOf(worst, getAlertSeverity(alert)),
			null
		),
		earliestStartsAt: alerts.reduce<string | null>((min, alert) => earlierOf(min, alert.startsAt ?? null), null),
		latestUpdatedAt: alerts.reduce<string | null>((max, alert) => laterOf(max, alert.updatedAt ?? null), null),
		alertIds: alerts.map((alert) => alert.id),
	};
};

// Provisional ids are negative so they can never collide with a server id; the create
// mutation swaps them for the real id the moment the server answers.
let provisionalSeq = 0;
export const nextProvisionalIncidentId = (): number => -++provisionalSeq;

// The summary the server will answer with, as far as the client can predict it: the
// creator owns it (ownerName from the users cache when loaded, else blank until the
// refetch), and the roll-ups come from the member rows.
export const provisionalIncident = (
	queryClient: QueryClient,
	id: number,
	{ name, description, alerts }: ProvisionalIncidentInput
): IncidentSummary => {
	const user = getCurrentUser();
	const users = queryClient.getQueryData<User[]>(queryKeys.users);
	const now = new Date().toISOString();
	return {
		id,
		name,
		description,
		createdBy: user?.id ?? null,
		createdAt: now,
		updatedAt: now,
		ownerName: users?.find((u) => String(u.id) === String(user?.id))?.fullName ?? null,
		...summarizeMembers(alerts),
	};
};

// Takes each alert out of the incident its row says it is in, adjusting that summary by
// the alert's own contribution. Severity and the time bounds are left as they were — the
// other members are not necessarily loaded, so they cannot be recomputed here; the
// refetch that follows every mutation corrects them. An incident that empties dissolves,
// as it does on the server.
export const withoutMembers = (incidents: IncidentSummary[], alerts: Alert[]): IncidentSummary[] => {
	const leaving = new Map<number, Alert[]>();
	for (const alert of alerts) {
		if (alert.incidentId == null) continue;
		leaving.set(alert.incidentId, [...(leaving.get(alert.incidentId) ?? []), alert]);
	}
	if (leaving.size === 0) return incidents;
	return incidents.flatMap((incident) => {
		const gone = leaving.get(incident.id);
		if (!gone) return [incident];
		const goneIds = new Set(gone.map((alert) => alert.id));
		const remaining = incident.alertIds.filter((id) => !goneIds.has(id));
		if (remaining.length === 0) return [];
		const delta = summarizeMembers(gone);
		return [
			{
				...incident,
				alertCount: remaining.length,
				firingCount: Math.max(0, incident.firingCount - delta.firingCount),
				silencedCount: Math.max(0, incident.silencedCount - delta.silencedCount),
				resolvedCount: Math.max(0, incident.resolvedCount - delta.resolvedCount),
				alertIds: remaining,
			},
		];
	});
};

// Adds the alerts to one incident's summary (a no-op when the list does not hold it).
export const withMembers = (incidents: IncidentSummary[], incidentId: number, alerts: Alert[]): IncidentSummary[] =>
	incidents.map((incident) => {
		if (incident.id !== incidentId) return incident;
		const delta = summarizeMembers(alerts);
		return {
			...incident,
			alertCount: incident.alertCount + delta.alertCount,
			firingCount: incident.firingCount + delta.firingCount,
			silencedCount: incident.silencedCount + delta.silencedCount,
			resolvedCount: incident.resolvedCount + delta.resolvedCount,
			worstSeverity: worseOf(incident.worstSeverity, delta.worstSeverity),
			earliestStartsAt: earlierOf(incident.earliestStartsAt, delta.earliestStartsAt),
			latestUpdatedAt: laterOf(incident.latestUpdatedAt, delta.latestUpdatedAt),
			alertIds: [...incident.alertIds, ...delta.alertIds],
		};
	});

// Applies one membership change to all three caches at once — the incidents list and
// the incidentId stamp on the alerts in every active and resolved list — cancelling
// in-flight polls first so none lands on top of the optimistic state. Returns what was
// there for restoreIncidentCaches.
export const applyIncidentChange = async (
	queryClient: QueryClient,
	alertIds: ReadonlySet<string>,
	stamp: number | undefined,
	incidents: (list: IncidentSummary[]) => IncidentSummary[]
): Promise<IncidentCacheSnapshot> => {
	await queryClient.cancelQueries({ queryKey: queryKeys.incidents });
	const before = queryClient.getQueryData<IncidentSummary[]>(queryKeys.incidents);
	queryClient.setQueryData<IncidentSummary[]>(queryKeys.incidents, (old) => incidents(old ?? []));
	const restamp = updateAlertsInCache(alertIds, (alert) => ({ ...alert, incidentId: stamp }));
	return {
		incidents: before,
		alerts: await applyToAlertCaches(queryClient, queryKeys.alerts, restamp),
		resolvedAlerts: await applyToAlertCaches(queryClient, queryKeys.resolvedAlerts, restamp),
	};
};

// The same rewrite, synchronous and WITHOUT cancelling anything: for the moment the
// server has answered. The settle step invalidates (and so refetches) right after, and
// a cancel here would kill that refetch and leave the caches to the next poll.
export const rewriteIncidentCaches = (
	queryClient: QueryClient,
	alertIds: ReadonlySet<string>,
	stamp: number | undefined,
	incidents: (list: IncidentSummary[]) => IncidentSummary[]
): void => {
	queryClient.setQueryData<IncidentSummary[]>(queryKeys.incidents, (old) => incidents(old ?? []));
	const restamp = updateAlertsInCache(alertIds, (alert) => ({ ...alert, incidentId: stamp }));
	queryClient.setQueriesData({ queryKey: queryKeys.alerts }, restamp);
	queryClient.setQueriesData({ queryKey: queryKeys.resolvedAlerts }, restamp);
};

export const restoreIncidentCaches = (queryClient: QueryClient, snapshot: IncidentCacheSnapshot | undefined): void => {
	if (!snapshot) return;
	queryClient.setQueryData(queryKeys.incidents, snapshot.incidents);
	restoreAlertCaches(queryClient, snapshot.alerts);
	restoreAlertCaches(queryClient, snapshot.resolvedAlerts);
};
