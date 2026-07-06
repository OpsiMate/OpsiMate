import { Alert, AlertSeverity, normalizeAlertSeverity } from '@OpsiMate/shared';

// Sort rank: higher = more severe, so a descending sort shows critical first.
export const SEVERITY_RANK: Record<AlertSeverity, number> = {
	[AlertSeverity.CRITICAL]: 3,
	[AlertSeverity.WARNING]: 2,
	[AlertSeverity.INFO]: 1,
};

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
	[AlertSeverity.CRITICAL]: 'Critical',
	[AlertSeverity.WARNING]: 'Warning',
	[AlertSeverity.INFO]: 'Info',
};

// Subtle full-row tint used by the "severity colors" table toggle. Opacity-based so it
// works in both light and dark themes.
export const SEVERITY_ROW_CLASSES: Record<AlertSeverity, string> = {
	[AlertSeverity.CRITICAL]: 'bg-red-500/10 hover:bg-red-500/20',
	[AlertSeverity.WARNING]: 'bg-amber-500/10 hover:bg-amber-500/20',
	[AlertSeverity.INFO]: 'bg-sky-500/10 hover:bg-sky-500/20',
};

export const SEVERITY_TEXT_CLASSES: Record<AlertSeverity, string> = {
	[AlertSeverity.CRITICAL]: 'text-red-500',
	[AlertSeverity.WARNING]: 'text-amber-500',
	[AlertSeverity.INFO]: 'text-sky-500',
};

// The server always sets severity, but data from older deployments or playground fixtures
// may miss it — fall back to a `severity` tag, then a `priority` tag (P1–P5, the signal
// TV mode has historically used), then the default, like the server does.
export const getAlertSeverity = (alert: Alert): AlertSeverity =>
	normalizeAlertSeverity(alert.severity ?? alert.tags?.['severity'] ?? alert.tags?.['priority']);
