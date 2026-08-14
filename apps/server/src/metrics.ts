import type Database from 'better-sqlite3';
import { NextFunction, Request, Response } from 'express';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

// Prometheus metrics (issue #658). Everything here is deliberately OUTSIDE the hot
// path: the alert gauges run plain COUNT/GROUP BY prepared statements at SCRAPE time
// (sub-millisecond at 10k rows) instead of reading the alerts snapshot — so a scrape
// can never trigger the expensive enrichment/mute-policy compute — and the request
// histogram and ingestion counter are in-memory increments.

export const metricsRegistry = new Registry();

// Process/runtime metrics: memory, CPU, event loop lag, GC, open handles.
collectDefaultMetrics({ register: metricsRegistry });

// Incremented in the single ingestion funnel (AlertBL.insertOrUpdateAlert), so every
// webhook source counts the same way. Label cardinality is bounded: a handful of
// integration types x three severities.
export const alertsIngestedTotal = new Counter({
	name: 'opsimate_alerts_ingested_total',
	help: 'Alerts received through the ingestion funnel (inserts and updates)',
	labelNames: ['type', 'severity'] as const,
	registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
	name: 'opsimate_http_request_duration_seconds',
	help: 'HTTP request duration by method, matched route and status code',
	labelNames: ['method', 'route', 'status_code'] as const,
	registers: [metricsRegistry],
});

// ---- applicative counters, incremented at the single BL funnel of each operation ----

export const alertsResolvedTotal = new Counter({
	name: 'opsimate_alerts_resolved_total',
	help: 'Alerts resolved, split by mode: manual (a user clicked resolve) vs auto (the source reported recovery)',
	labelNames: ['mode'] as const,
	registers: [metricsRegistry],
});

export const alertsSilencedTotal = new Counter({
	name: 'opsimate_alerts_silenced_total',
	help: 'Silence operations applied to alerts',
	registers: [metricsRegistry],
});

export const alertsUnsilencedTotal = new Counter({
	name: 'opsimate_alerts_unsilenced_total',
	help: 'Unsilence operations applied to alerts (manual, timer expiry, and daily reset)',
	registers: [metricsRegistry],
});

export const actionsRunTotal = new Counter({
	name: 'opsimate_actions_run_total',
	help: 'Actions executed against alerts, by action type and outcome',
	labelNames: ['type', 'outcome'] as const,
	registers: [metricsRegistry],
});

export const bulkActionsTotal = new Counter({
	name: 'opsimate_bulk_actions_total',
	help: 'Bulk operations executed (one increment per request, whatever its size)',
	labelNames: ['action'] as const,
	registers: [metricsRegistry],
});

export const bulkAlertsAffectedTotal = new Counter({
	name: 'opsimate_bulk_alerts_affected_total',
	help: 'Alerts actually mutated by bulk operations (the succeeded count)',
	labelNames: ['action'] as const,
	registers: [metricsRegistry],
});

// Visibility into the snapshot cache the whole read path sits on: how often the full
// alert list is recomputed (enrichments + mute policies + comments + firing times) and
// how long it takes. Wraps a computation that runs anyway — zero added cost.
export const snapshotComputeDuration = new Histogram({
	name: 'opsimate_snapshot_compute_duration_seconds',
	help: 'Duration of full alert-snapshot recomputes, by list',
	labelNames: ['list'] as const,
	registers: [metricsRegistry],
});

// Alert state gauges, resolved lazily per scrape. States mirror what the product
// shows: firing and silenced live in the alerts table (is_dismissed is the silence
// flag), resolved in alerts_resolved. "Muted" is a read-time mute-policy computation
// over the snapshot, not a stored state — surfacing it would drag rule evaluation
// into every scrape, so it is deliberately absent.
interface StateCountRow {
	state: string;
	severity: string | null;
	count: number;
}

// Bound by initMetrics; the gauges below read through them so initMetrics stays
// idempotent (tests build several apps in one process — a second Gauge with the same
// name would throw on registration).
let countByStateAndSeverity: Database.Statement | null = null;
let firingTriageCounts: Database.Statement | null = null;
let oldestFiringStartsAt: Database.Statement | null = null;
let resourceCounts: Database.Statement | null = null;

export const initMetrics = (db: Database.Database): void => {
	countByStateAndSeverity = db.prepare(`
		SELECT CASE WHEN is_dismissed = 1 THEN 'silenced' ELSE 'firing' END AS state,
		       severity, COUNT(*) AS count
		FROM alerts
		GROUP BY state, severity
		UNION ALL
		SELECT 'resolved' AS state, severity, COUNT(*) AS count
		FROM alerts_resolved
		GROUP BY severity
	`);
	firingTriageCounts = db.prepare(`
		SELECT SUM(CASE WHEN owner_id IS NULL THEN 1 ELSE 0 END) AS unassigned,
		       SUM(CASE WHEN is_read = 0 OR is_read IS NULL THEN 1 ELSE 0 END) AS unread
		FROM alerts WHERE is_dismissed = 0
	`);
	oldestFiringStartsAt = db.prepare(`SELECT MIN(starts_at) AS oldest FROM alerts WHERE is_dismissed = 0`);
	resourceCounts = db.prepare(`
		SELECT 'users' AS kind, COUNT(*) AS count FROM users
		UNION ALL SELECT 'integrations', COUNT(*) FROM integrations
		UNION ALL SELECT 'dashboards', COUNT(*) FROM dashboards
		UNION ALL SELECT 'enrichment_rules', COUNT(*) FROM alert_enrichments
		UNION ALL SELECT 'mute_policies', COUNT(*) FROM alert_mute_policies
		UNION ALL SELECT 'actions', COUNT(*) FROM actions
		UNION ALL SELECT 'oncall_teams', COUNT(*) FROM oncall_teams
	`);
};

new Gauge({
	name: 'opsimate_alerts',
	help: 'Current number of alerts by state (firing, silenced, resolved)',
	labelNames: ['state'] as const,
	registers: [metricsRegistry],
	collect() {
		if (!countByStateAndSeverity) return;
		const totals: Record<string, number> = { firing: 0, silenced: 0, resolved: 0 };
		for (const row of countByStateAndSeverity.all() as StateCountRow[]) {
			totals[row.state] = (totals[row.state] ?? 0) + row.count;
		}
		this.reset();
		for (const [state, count] of Object.entries(totals)) {
			this.set({ state }, count);
		}
	},
});

new Gauge({
	name: 'opsimate_alerts_by_severity',
	help: 'Current number of alerts by state and severity',
	labelNames: ['state', 'severity'] as const,
	registers: [metricsRegistry],
	collect() {
		if (!countByStateAndSeverity) return;
		this.reset();
		for (const row of countByStateAndSeverity.all() as StateCountRow[]) {
			this.set({ state: row.state, severity: row.severity ?? 'unknown' }, row.count);
		}
	},
});

// Triage backlog: firing alerts nobody owns and nobody has looked at.
new Gauge({
	name: 'opsimate_firing_alerts_unassigned',
	help: 'Firing alerts with no owner',
	registers: [metricsRegistry],
	collect() {
		if (!firingTriageCounts) return;
		const row = firingTriageCounts.get() as { unassigned: number | null; unread: number | null };
		this.set(row.unassigned ?? 0);
	},
});

new Gauge({
	name: 'opsimate_firing_alerts_unread',
	help: 'Firing alerts no one has opened yet',
	registers: [metricsRegistry],
	collect() {
		if (!firingTriageCounts) return;
		const row = firingTriageCounts.get() as { unassigned: number | null; unread: number | null };
		this.set(row.unread ?? 0);
	},
});

// Age of the longest-firing alert — the "is something rotting unhandled" signal.
// 0 when nothing is firing.
new Gauge({
	name: 'opsimate_oldest_firing_alert_age_seconds',
	help: 'Age in seconds of the oldest currently-firing alert (0 when none)',
	registers: [metricsRegistry],
	collect() {
		if (!oldestFiringStartsAt) return;
		const row = oldestFiringStartsAt.get() as { oldest: string | null };
		const started = row.oldest ? Date.parse(row.oldest) : NaN;
		this.set(Number.isFinite(started) ? Math.max(0, (Date.now() - started) / 1000) : 0);
	},
});

// Inventory of configured objects — trend lines answer "who added 40 mute policies".
new Gauge({
	name: 'opsimate_resources',
	help: 'Count of configured resources by kind (users, integrations, dashboards, rules, ...)',
	labelNames: ['kind'] as const,
	registers: [metricsRegistry],
	collect() {
		if (!resourceCounts) return;
		this.reset();
		for (const row of resourceCounts.all() as { kind: string; count: number }[]) {
			this.set({ kind: row.kind }, row.count);
		}
	},
});

// Times every request against the MATCHED route pattern (e.g. /api/v1/alerts/:id/silence),
// never the raw URL — raw paths would explode label cardinality with every alert id and
// every scanner probe. Unmatched requests all share one 'unmatched' series.
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
	const end = httpRequestDuration.startTimer();
	res.on('finish', () => {
		const route = req.route ? `${req.baseUrl}${(req.route as { path: string }).path}` : 'unmatched';
		end({ method: req.method, route, status_code: String(res.statusCode) });
	});
	next();
};

// Scrape endpoint. Open by default (Prometheus-friendly, exposes only counts and
// timings); setting METRICS_TOKEN requires `Authorization: Bearer <token>`. Read per
// request so tests — and operators — can change it without a rebuild.
export const metricsHandler = async (req: Request, res: Response): Promise<void> => {
	const token = process.env.METRICS_TOKEN;
	if (token && req.headers.authorization !== `Bearer ${token}`) {
		res.status(401).send('unauthorized');
		return;
	}
	res.set('Content-Type', metricsRegistry.contentType);
	res.send(await metricsRegistry.metrics());
};
