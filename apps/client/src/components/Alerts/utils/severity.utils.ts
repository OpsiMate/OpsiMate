import { AlertSeverity } from '@OpsiMate/shared';

// The logic (rank, labels, fallback chain) lives in @OpsiMate/shared so the server
// filters and sorts with identical semantics; only the visual classes are client-side.
export { SEVERITY_RANK, SEVERITY_LABELS, getAlertSeverity } from '@OpsiMate/shared';

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
