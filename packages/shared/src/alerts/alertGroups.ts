import { Alert, AlertStatus } from '../types';
import {
	AlertOwnerInfo,
	FIX_LABELS,
	getAlertFix,
	getAlertSeverity,
	getIntegrationLabel,
	getOwnerDisplayName,
	getTagKeyValue,
	isTagKeyColumn,
	resolveAlertIntegration,
	SEVERITY_LABELS,
} from './alertView';

// Grouping semantics — the value an alert groups under, and group summaries (counts +
// rolled-up status) computed WITHOUT shipping the alerts. One implementation for both
// sides: the client groups loaded rows with it, and the server serves summary counts
// over the full dataset with it, so a header count can never land on a different bucket
// than the rows beneath it.

// Day bucket for date grouping, in the VIEWER's timezone. The client passes nothing
// (runtime local = the viewer); the server passes the IANA timezone the client sent —
// a fixed UTC offset would mis-bucket dates across DST boundaries, an IANA zone won't.
// 'en-CA' formats as YYYY-MM-DD, matching the key shape grouping has always used.
export const makeDayKeyFn = (timeZone?: string) => {
	return (dateString: string): string => {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return 'Unknown';
		try {
			return date.toLocaleDateString('en-CA', timeZone ? { timeZone } : undefined);
		} catch {
			// Unknown/invalid zone name: fall back to the runtime's local zone rather
			// than failing the whole summaries request.
			return date.toLocaleDateString('en-CA');
		}
	};
};

const defaultDayKey = makeDayKeyFn();

// The value an alert presents for a GROUPING field. Note the deliberate differences from
// the filter-field values (getAlertFilterFieldValue): missing tag values group under
// 'N/A' (filters use ''), unknown fields group under 'Unknown' (filters never constrain),
// and status buckets any non-silenced/non-muted alert as 'Firing' — a long-standing
// behavior ported as-is so server summaries match the client's buckets exactly.
export const getAlertGroupValue = (
	alert: Alert,
	field: string,
	users: AlertOwnerInfo[],
	dayKey: (dateString: string) => string = defaultDayKey
): string => {
	if (isTagKeyColumn(field)) {
		return getTagKeyValue(alert, field) || 'N/A';
	}
	switch (field) {
		case 'alertName':
			return alert.alertName;
		case 'status':
			return alert.isSilenced ? 'Silenced' : alert.isMuted ? 'Muted' : 'Firing';
		case 'severity':
			return SEVERITY_LABELS[getAlertSeverity(alert)];
		case 'fix': {
			const fix = getAlertFix(alert);
			return fix ? FIX_LABELS[fix] : 'No fix type';
		}
		case 'summary':
			return alert.summary || 'Unknown';
		case 'startsAt':
			return dayKey(alert.startsAt);
		case 'updatedAt':
			return dayKey(alert.updatedAt);
		case 'type':
			return getIntegrationLabel(resolveAlertIntegration(alert));
		case 'owner':
			return getOwnerDisplayName(alert.ownerId, users);
		default:
			return 'Unknown';
	}
};

export type AlertGroupStatus = 'firing' | 'muted' | 'resolved' | 'silenced';

// One path segment of a group key. Values are URI-encoded so a value containing ':'
// (tag values like "env:prod" exist in the wild) cannot collide with a nested path —
// 'root:a%3Ab' and 'root:a:b' stay distinct. Both group builders (this one and the
// client's row tree) use it, so summary joins by key are unambiguous.
export const groupKeySegment = (parentKey: string, value: string): string =>
	`${parentKey}:${encodeURIComponent(value)}`;

export interface AlertGroupSummaryNode {
	// Same key scheme the client's group tree uses (see groupKeySegment), so summary
	// counts can be joined onto rendered group headers by key.
	key: string;
	field: string;
	value: string;
	count: number;
	status: AlertGroupStatus;
	level: number;
	children: AlertGroupSummaryNode[];
}

const leafStatus = (alert: Alert): AlertGroupStatus => {
	if (alert.isSilenced) return 'silenced';
	if (alert.isMuted) return 'muted';
	return alert.status === AlertStatus.FIRING ? 'firing' : 'resolved';
};

// Rollup precedence mirrors the client's getGroupStatus: firing > muted > resolved,
// with an all-silenced group reading silenced.
const rollupStatus = (statuses: Iterable<AlertGroupStatus>): AlertGroupStatus => {
	let hasFiring = false;
	let hasMuted = false;
	let hasResolved = false;
	for (const s of statuses) {
		if (s === 'firing') hasFiring = true;
		else if (s === 'muted') hasMuted = true;
		else if (s === 'resolved') hasResolved = true;
	}
	if (hasFiring) return 'firing';
	if (hasMuted) return 'muted';
	if (hasResolved) return 'resolved';
	return 'silenced';
};

const summarizeRecursive = (
	alerts: Alert[],
	groupBy: string[],
	level: number,
	parentKey: string,
	users: AlertOwnerInfo[],
	dayKey: (dateString: string) => string
): AlertGroupSummaryNode[] => {
	if (groupBy.length === 0) return [];
	const [currentField, ...restFields] = groupBy;

	const buckets: Record<string, Alert[]> = {};
	for (const alert of alerts) {
		const value = getAlertGroupValue(alert, currentField, users, dayKey);
		(buckets[value] ??= []).push(alert);
	}

	// Lexicographic key order — the client's group tree sorts the same way.
	return Object.keys(buckets)
		.sort()
		.map((value) => {
			const groupKey = groupKeySegment(parentKey, value);
			const members = buckets[value];
			const children = summarizeRecursive(members, restFields, level + 1, groupKey, users, dayKey);
			return {
				key: groupKey,
				field: currentField,
				value,
				count: members.length,
				status: rollupStatus(members.map(leafStatus)),
				level,
				children,
			};
		});
};

// Group counts + rollup status over a full dataset, no alerts in the payload — what the
// client needs to render honest group headers when it has only a page of rows loaded.
export const computeAlertGroupSummaries = (
	alerts: Alert[],
	groupBy: string[],
	users: AlertOwnerInfo[],
	timeZone?: string
): AlertGroupSummaryNode[] => {
	return summarizeRecursive(alerts, groupBy, 0, 'root', users, makeDayKeyFn(timeZone));
};
