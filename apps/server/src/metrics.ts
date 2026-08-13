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

// Bound by initMetrics; the gauges below read through it so initMetrics stays
// idempotent (tests build several apps in one process — a second Gauge with the same
// name would throw on registration).
let countByStateAndSeverity: Database.Statement | null = null;

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
