import { toCsv } from '@/lib/csv';
import { Alert, AlertOwnerInfo, AlertStatus, getAlertTagEntries, getOwnerDisplayName } from '@OpsiMate/shared';

export const ALERTS_CSV_HEADER = [
	'id',
	'name',
	'status',
	'severity',
	'source',
	'team',
	'owner',
	'started_at',
	'updated_at',
	'silenced_until',
	'tags',
	'summary',
	'last_comment',
	'alert_url',
	'runbook_url',
];

// Same precedence as the status badge: silenced > muted > firing/resolved. The "All"
// view tags resolved rows with isResolved, so honor that alongside the status field.
export const getAlertExportStatus = (alert: Alert): string => {
	if (alert.isResolved || alert.status === AlertStatus.RESOLVED) return 'resolved';
	if (alert.isSilenced) return 'silenced';
	if (alert.isMuted) return 'muted';
	return 'firing';
};

// "env=prod; region=eu" — one cell, still splittable on "; " in a spreadsheet.
const formatTags = (alert: Alert): string =>
	getAlertTagEntries(alert)
		.map(({ key, value }) => `${key}=${value}`)
		.join('; ');

type Cell = string | null | undefined;

const alertToRow = (alert: Alert, users: AlertOwnerInfo[]): Cell[] => [
	alert.id,
	alert.alertName,
	getAlertExportStatus(alert),
	alert.severity,
	alert.type,
	alert.team,
	alert.ownerId ? getOwnerDisplayName(alert.ownerId, users) : null,
	alert.startsAt,
	alert.updatedAt,
	alert.isSilenced ? alert.silencedUntil : null,
	formatTags(alert),
	alert.summary,
	alert.lastComment,
	alert.alertUrl,
	alert.runbookUrl,
];

// Timestamps stay as the ISO strings the API sends: unambiguous, timezone-safe, and
// parsed as dates by every spreadsheet. Absent values become empty cells, never "null".
export const alertsToCsv = (alerts: Alert[], users: AlertOwnerInfo[] = []): string =>
	toCsv(
		ALERTS_CSV_HEADER,
		alerts.map((alert) => alertToRow(alert, users).map((cell) => cell ?? ''))
	);

// "alerts-production-2026-11-19-14-05-09.csv" — the view name keeps exports from
// different dashboards apart; it is sanitized because dashboard names are free text.
export const alertsExportFilename = (viewName: string | undefined, stamp: string): string => {
	const safeName = (viewName ?? '')
		.trim()
		.toLowerCase()
		.replace(/[^\w.-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return `alerts${safeName ? `-${safeName}` : ''}-${stamp}.csv`;
};
