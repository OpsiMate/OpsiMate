#!/usr/bin/env node
// Ingest load generator: hammers POST /api/v1/alerts/custom with C concurrent posters
// for D seconds while a probe times GET /api/v1/alerts (the UI's poll) every 500 ms
// and samples the server's event-loop utilization from /metrics.
//
//   node apps/server/scripts/ingest-load.mjs [concurrency=32] [seconds=15] [base=http://localhost:3001] [token=opsimate] [pid]
//
// Point it at a scratch instance, never at a real one: it writes `load-*` alerts.
// Clean up afterwards with:
//   DELETE FROM alerts WHERE id LIKE 'load-%'; DELETE FROM alerts_history WHERE alert_id LIKE 'load-%';
//
// Reference numbers (8-core laptop, scratch DB, 12–15 s runs, closed-loop posters):
//                       ingest req/s     GET /alerts p50 (idle: 4 ms)
//   before batching   C=8 3,138 / C=32 2,085 / C=128 2,002     273 / 500 / 748 ms
//   after  batching   C=8 4,584 / C=32 4,029 / C=128 4,016     294 / 271 / 349 ms
//   sequential sender (C=1): 2,775 req/s at 0 ms p50 — batching adds no latency.

import { execSync } from 'node:child_process';

const [, , cArg = '32', dArg = '15', base = 'http://localhost:3001', token = 'opsimate', pid] = process.argv;
const C = Number(cArg);
const D = Number(dArg) * 1000;
const H = `${base.replace(/\/$/, '')}/api/v1`;

const pct = (values, p) =>
	values.length
		? values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(p * values.length))]
		: NaN;

// Every request gets a deadline: Node's fetch would otherwise wait up to 300 s on a
// server that accepts the connection but never answers, and the report would hang
// with it.
const REQUEST_TIMEOUT_MS = 10_000;

const run = `load-${Date.now()}`;
// INGEST_ID_POOL=N: cycle through N fixed ids instead of minting a new one per request,
// so the storm re-fires the same alerts (the common real case) and the table stays the
// same size for the whole run instead of growing with the throughput being measured.
const ID_POOL = Number(process.env.INGEST_ID_POOL) || 0;
// INGEST_TAGS=N: N tags per alert instead of two — a mix of low-cardinality values
// (facet-heavy) and per-alert values (search-text-heavy), like a real label set.
const TAG_COUNT = Number(process.env.INGEST_TAGS) || 2;
const tagsFor = (n) => {
	const tags = { env: 'load', team: 'perf' };
	for (let k = 2; k < TAG_COUNT; k++) {
		tags[`label_${k}`] = k % 3 === 0 ? `pod-${(n * 31 + k) % 500}` : k % 3 === 1 ? `zone-${(n + k) % 8}` : `component-${(n * 7 + k) % 40}`;
	}
	return tags;
};
let posted = 0;
let failed = 0;
let getFailed = 0;
let metricsFailed = 0;
const postLatency = [];
const getLatency = []; // successful probes only
const elu = [];
const cpu = [];
const t0 = Date.now();

const poster = async (worker) => {
	let i = 0;
	while (Date.now() - t0 < D) {
		const id = ID_POOL > 0 ? `load-pool-${(worker + i++ * C) % ID_POOL}` : `${run}-${worker}-${i++}`;
		const started = performance.now();
		try {
			const res = await fetch(`${H}/alerts/custom?api_token=${token}`, {
				method: 'POST',
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					id,
					// A pool of rule names, not one per alert: real sources fire the same rule
					// on many instances, and the facets sidebar lists every distinct name —
					// unique names made that payload 1.8MB at 50k alerts and dominated the
					// UI-side numbers instead of the ingest path this script exists for.
					alertName: `load rule ${posted % 200}`,
					tags: tagsFor(posted + worker),
					severity: 'warning',
					summary: 'synthetic',
				}),
			});
			if (res.ok) posted++;
			else failed++;
		} catch {
			failed++;
		}
		postLatency.push(performance.now() - started);
	}
};

const probe = async () => {
	while (Date.now() - t0 < D) {
		const started = performance.now();
		try {
			const res = await fetch(`${H}/alerts?api_token=${token}&limit=50`, {
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
			if (res.ok) getLatency.push(performance.now() - started);
			else getFailed++;
		} catch {
			getFailed++;
		}
		try {
			const res = await fetch(`${base}/metrics`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
			if (!res.ok) {
				// e.g. 401 when METRICS_TOKEN protects the endpoint — a failed probe, not a sample
				metricsFailed++;
			} else {
				const match = (await res.text()).match(/^opsimate_event_loop_utilization\s+([\d.]+)/m);
				if (match) elu.push(Number(match[1]));
			}
		} catch {
			metricsFailed++;
		}
		if (pid) {
			try {
				cpu.push(Number(execSync(`ps -o %cpu= -p ${pid}`).toString().trim()));
			} catch {
				// process may have exited
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
};

await Promise.all([...Array.from({ length: C }, (_, worker) => poster(worker)), probe()]);
const seconds = (Date.now() - t0) / 1000;
console.log(
	`C=${C} ${seconds.toFixed(0)}s | ingest ${(posted / seconds).toFixed(0)} req/s (${posted} ok, ${failed} failed)` +
		` | POST p50 ${pct(postLatency, 0.5).toFixed(0)}ms p99 ${pct(postLatency, 0.99).toFixed(0)}ms` +
		` | GET /alerts p50 ${pct(getLatency, 0.5).toFixed(0)}ms p99 ${pct(getLatency, 0.99).toFixed(0)}ms` +
		(getFailed ? ` (${getFailed} probe failures)` : '') +
		(metricsFailed ? ` (${metricsFailed} metrics failures)` : '') +
		` | ELU p50 ${pct(elu, 0.5).toFixed(2)}` +
		(cpu.length ? ` | server CPU p50 ${pct(cpu, 0.5)}% max ${Math.max(...cpu)}%` : '')
);
