import { Alert, AlertLink } from '@OpsiMate/shared';

// The alert's effective link collection. `links` is the source of truth when present;
// otherwise the legacy alertUrl/runbookUrl pair folds in so pre-links alerts (and the
// built-in integrations, which still populate those fields) keep their buttons. The
// legacy Source entry carries the alert's type as its icon slug — a Grafana alert's
// source link IS Grafana.
export const getAlertLinks = (alert: Alert): AlertLink[] => {
	if (alert.links?.length) return alert.links;
	const legacy: AlertLink[] = [];
	if (alert.alertUrl) legacy.push({ label: 'Source', icon: alert.type, url: alert.alertUrl });
	if (alert.runbookUrl) legacy.push({ label: 'Runbook', icon: '', url: alert.runbookUrl });
	return legacy;
};
