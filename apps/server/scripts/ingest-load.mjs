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
// Reference numbers (8-core laptop, scratch DB, PR #1028):
//   before batching: ~2,100 req/s at C=32, GET /alerts p50 500 ms (4 ms idle), ELU 1.00
//   after  batching: see the PR description.

import { execSync } from 'node:child_process';

const [, , cArg = '32', dArg = '15', base = 'http://localhost:3001', token = 'opsimate', pid] = process.argv;
const C = Number(cArg);
const D = Number(dArg) * 1000;
const H = `${base.replace(/\/$/, '')}/api/v1`;

const pct = (values, p) =>
	values.length
		? values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(p * values.length))]
		: NaN;

const run = `load-${Date.now()}`;
let posted = 0;
let failed = 0;
const postLatency = [];
const getLatency = [];
const elu = [];
const cpu = [];
const t0 = Date.now();

const poster = async (worker) => {
	let i = 0;
	while (Date.now() - t0 < D) {
		const id = `${run}-${worker}-${i++}`;
		const started = performance.now();
		try {
			const res = await fetch(`${H}/alerts/custom?api_token=${token}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					id,
					alertName: `load ${id}`,
					tags: { env: 'load', team: 'perf' },
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
			await fetch(`${H}/alerts?api_token=${token}&limit=50`);
		} catch {
			// counted as latency anyway
		}
		getLatency.push(performance.now() - started);
		try {
			const metrics = await (await fetch(`${base}/metrics`)).text();
			const match = metrics.match(/^opsimate_event_loop_utilization\s+([\d.]+)/m);
			if (match) elu.push(Number(match[1]));
		} catch {
			// metrics may be disabled
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
		` | ELU p50 ${pct(elu, 0.5).toFixed(2)}` +
		(cpu.length ? ` | server CPU p50 ${pct(cpu, 0.5)}% max ${Math.max(...cpu)}%` : '')
);
