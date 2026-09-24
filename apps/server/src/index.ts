import cluster, { Worker } from 'node:cluster';
import os from 'node:os';
import { AggregatorRegistry } from 'prom-client';
import { initializeDb } from './dal/db';
import { createApp, AppMode } from './app';
import { getServerConfig } from './config/config';
import { warnIfEncryptionKeyInsecure } from './utils/encryption';
import { CLUSTER_METRICS_REPLY, CLUSTER_METRICS_REQUEST, ClusterMetricsReply, ClusterMetricsRequest } from './metrics';
import { Logger } from '@OpsiMate/shared';

const logger = new Logger('server');

// How many HTTP worker processes to run. The server is single-threaded and its
// synchronous SQLite driver runs on that thread, so one process saturates one core at
// a few thousand webhooks a second while the UI's polls queue behind them (PR #1028).
// Workers share the port (Node cluster) and share the database (SQLite WAL, one
// writer at a time — cheap thanks to batched ingest); in-memory caches stay
// consistent across workers through the cache_generation row (see
// CacheGenerationRepository). Capped at 4 by default: every worker holds its own
// snapshot of all active alerts, so memory scales with the count.
const MAX_DEFAULT_WORKERS = 4;
const workerCount = (): number => {
	const raw = process.env.WEB_CONCURRENCY;
	const parsed = Number(raw);
	if (raw !== undefined && raw !== '' && Number.isInteger(parsed) && parsed >= 1) return parsed;
	return Math.max(1, Math.min(os.availableParallelism(), MAX_DEFAULT_WORKERS));
};

const serverAddress = () => {
	const serverConfig = getServerConfig();
	// Allow environment variable to override config file
	const port = process.env.PORT ? parseInt(process.env.PORT, 10) : serverConfig.port;
	const host = process.env.HOST || serverConfig.host;
	return { port, host };
};

// One HTTP process: the whole app, listening. In cluster mode each worker runs this.
async function serve(): Promise<void> {
	const { port, host } = serverAddress();
	const db = initializeDb();
	const app = await createApp(db, AppMode.SERVER);
	if (!app) {
		throw new Error('Failed to create Express application');
	}
	const server = app.listen(port, host, () => {
		logger.info(`Server running on ${host}:${port}${cluster.isWorker ? ` (worker ${process.pid})` : ''}`);
	});
	const shutdown = () => {
		server.close(() => process.exit(0));
		// A worker that can't drain its connections in time must not hang the rollout.
		setTimeout(() => process.exit(0), 10_000).unref();
	};
	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);
}

// The primary never serves HTTP. It runs the schema init exactly once (so N workers
// never race the same ALTER TABLE), forks the workers, respawns any that die, and
// answers their /metrics aggregation requests.
async function primary(workers: number): Promise<void> {
	const db = initializeDb();
	await createApp(db, AppMode.INIT);
	db.close();

	const aggregator = new AggregatorRegistry();
	let shuttingDown = false;

	const wire = (worker: Worker) => {
		worker.on('message', (raw: unknown) => {
			const message = raw as Partial<ClusterMetricsRequest>;
			if (message?.type !== CLUSTER_METRICS_REQUEST || typeof message.id !== 'number') return;
			const id = message.id;
			void aggregator
				.clusterMetrics()
				.then((body) => worker.send({ type: CLUSTER_METRICS_REPLY, id, body } satisfies ClusterMetricsReply))
				.catch((error: unknown) =>
					worker.send({
						type: CLUSTER_METRICS_REPLY,
						id,
						error: error instanceof Error ? error.message : String(error),
					} satisfies ClusterMetricsReply)
				);
		});
	};

	for (let i = 0; i < workers; i++) wire(cluster.fork());

	cluster.on('exit', (worker, code, signal) => {
		if (shuttingDown) return;
		logger.warn(`Worker ${worker.process.pid} exited (${signal ?? code}); starting a replacement`);
		wire(cluster.fork());
	});

	const shutdown = () => {
		shuttingDown = true;
		for (const worker of Object.values(cluster.workers ?? {})) worker?.process.kill('SIGTERM');
		setTimeout(() => process.exit(0), 12_000).unref();
	};
	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);

	const { port, host } = serverAddress();
	logger.info(`Primary ${process.pid}: ${workers} HTTP workers on ${host}:${port} (WEB_CONCURRENCY)`);
}

await (async () => {
	const workers = workerCount();
	if (cluster.isPrimary) {
		// Nudge, don't block: a production boot with no ENCRYPTION_KEY encrypts credentials
		// under the public fallback key — warn loudly but keep existing deployments running.
		warnIfEncryptionKeyInsecure();
		if (workers > 1) {
			await primary(workers);
			return;
		}
	}
	await serve();
})();
