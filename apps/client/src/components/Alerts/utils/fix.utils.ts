import { Alert, AlertFix, normalizeAlertFix } from '@OpsiMate/shared';

export const FIX_LABELS: Record<AlertFix, string> = {
	[AlertFix.MANUAL]: 'Manual fix',
	[AlertFix.AUTO]: 'Auto fix',
};

// Sort rank: higher = needs a human, so a descending sort surfaces manual-fix alerts
// first; unclassified alerts (null) rank 0 and sink to the end either way.
export const FIX_RANK: Record<AlertFix, number> = {
	[AlertFix.MANUAL]: 2,
	[AlertFix.AUTO]: 1,
};

// The fix classification rides on a `fix` tag (there is no first-class column like
// severity's); null when the alert carries no recognizable value.
export const getAlertFix = (alert: Alert): AlertFix | null => normalizeAlertFix(alert.tags?.['fix']);
