import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { Alert, Logger } from '@OpsiMate/shared';
import { ActiveListBuild } from './activeListBuilder';

const logger = new Logger('bl/snapshotWorker');

// Wire protocol between the main thread and snapshotWorker.ts.
export interface BuildRequest {
	type: 'build';
	seq: number;
}

export interface BuildReply {
	type: 'built';
	seq: number;
	// Every listed id, in list order — small (ids only) and enough to apply `changed`.
	// null: the same order as the previous reply, so nothing to deserialize on the
	// receiving side (the common case: a rebuild that found nothing changed).
	order: string[] | null;
	changed: Alert[];
	fingerprint: string;
}

export interface BuildFailure {
	type: 'failed';
	seq: number;
	message: string;
}

export type WorkerMessage = BuildReply | BuildFailure;

export interface SnapshotWorkerData {
	dbPath: string;
}

// The main thread's copy of the list, patched from a delta: `changed` replaces those
// ids, `order` says which ids are listed and how. Anything not in `order` is gone.
export const applyListDelta = (known: Map<string, Alert>, order: string[], changed: Alert[]): Alert[] => {
	for (const alert of changed) known.set(alert.id, alert);
	const alerts: Alert[] = [];
	const listed = new Set<string>();
	for (const id of order) {
		const alert = known.get(id);
		if (alert === undefined) throw new Error(`snapshot worker listed unknown alert ${id}`);
		alerts.push(alert);
		listed.add(id);
	}
	for (const id of known.keys()) {
		if (!listed.has(id)) known.delete(id);
	}
	return alerts;
};

export interface WorkerScript {
	file: string;
}

// Where the worker's code is: in a source checkout (vite dev, vitest) the TypeScript
// next to this file, started through the snapshotWorker.dev.mjs bootstrap (see there
// for why a loader flag is not enough); in the production bundle, dist/snapshotWorker.js
// next to the entry script.
export const resolveWorkerScript = (): WorkerScript | null => {
	const here = fileURLToPath(import.meta.url);
	if (here.endsWith('.ts')) {
		return { file: path.join(path.dirname(here), 'snapshotWorker.dev.mjs') };
	}
	// The bundle puts entries in dist/ and this module in a chunk under dist/assets/;
	// the entry script's directory is checked first, then relative to this chunk, so a
	// process started other than `node dist/index.js` (a profiler's -e wrapper, say)
	// still finds it.
	const candidates = [
		process.argv[1] ? path.join(path.dirname(process.argv[1]), 'snapshotWorker.js') : null,
		path.join(path.dirname(here), 'snapshotWorker.js'),
		path.join(path.dirname(here), '..', 'snapshotWorker.js'),
	];
	for (const file of candidates) {
		if (file && fs.existsSync(file)) return { file };
	}
	return null;
};

const BUILD_TIMEOUT_MS = 60_000;

interface PendingBuild {
	seq: number;
	resolve: (build: ActiveListBuild) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
}

// Runs the active-list build on a worker thread, over the worker's own connection to
// the same database file, and keeps the main thread's copy of the list patched from
// the worker's deltas. What the main thread pays per rebuild is then proportional to
// what changed, not to the size of the list; the rebuild itself (row read, mapping,
// rules, history) no longer blocks requests at all.
//
// One build in flight at a time (SnapshotCache already serializes computes; the
// queue here is belt and braces). A worker that dies or times out fails that build
// — the caller falls back to an inline build — and is replaced on the next one; the
// replacement's first reply is a full list, so the copy here is rebuilt from scratch.
export class SnapshotWorkerClient {
	private worker: Worker | null = null;
	private known = new Map<string, Alert>();
	private lastOrder: string[] = [];
	private pending: PendingBuild | null = null;
	private queue: Promise<unknown> = Promise.resolve();
	private seq = 0;

	constructor(
		private readonly dbPath: string,
		private readonly script: WorkerScript
	) {}

	build(): Promise<ActiveListBuild> {
		const run = this.queue.then(() => this.buildOnce());
		this.queue = run.catch(() => undefined);
		return run;
	}

	private buildOnce(): Promise<ActiveListBuild> {
		const worker = this.worker ?? this.spawn();
		const seq = ++this.seq;
		return new Promise<ActiveListBuild>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.fail(new Error(`snapshot worker did not answer within ${BUILD_TIMEOUT_MS}ms`));
			}, BUILD_TIMEOUT_MS);
			timer.unref();
			this.pending = { seq, resolve, reject, timer };
			// An idle worker must not keep the process alive; a build in flight must.
			worker.ref();
			worker.postMessage({ type: 'build', seq } satisfies BuildRequest);
		});
	}

	private spawn(): Worker {
		const workerData: SnapshotWorkerData = { dbPath: this.dbPath };
		const worker = new Worker(this.script.file, { workerData });
		worker.on('message', (message: WorkerMessage) => this.onMessage(worker, message));
		worker.on('error', (error) => this.onExit(worker, `snapshot worker error: ${error.message}`));
		worker.on('exit', (code) => this.onExit(worker, `snapshot worker exited with code ${code}`));
		worker.unref();
		this.worker = worker;
		this.known = new Map();
		this.lastOrder = [];
		logger.info(`snapshot worker thread started (${path.basename(this.script.file)}, thread ${worker.threadId})`);
		return worker;
	}

	private onMessage(worker: Worker, message: WorkerMessage): void {
		if (worker !== this.worker) return;
		const pending = this.pending;
		if (!pending || message.seq !== pending.seq) return;
		clearTimeout(pending.timer);
		this.pending = null;
		worker.unref();
		if (message.type === 'failed') {
			pending.reject(new Error(message.message));
			return;
		}
		try {
			const order = message.order ?? this.lastOrder;
			const alerts = applyListDelta(this.known, order, message.changed);
			this.lastOrder = order;
			pending.resolve({ alerts, changed: message.changed, fingerprint: message.fingerprint });
		} catch (error) {
			// The copy here is out of step with the worker: start over on the next build.
			this.discardWorker();
			pending.reject(error instanceof Error ? error : new Error(String(error)));
		}
	}

	private onExit(worker: Worker, reason: string): void {
		if (worker !== this.worker) return;
		logger.warn(`${reason}; the next build starts a replacement`);
		this.worker = null;
		this.known = new Map();
		this.lastOrder = [];
		this.fail(new Error(reason));
	}

	private fail(error: Error): void {
		const pending = this.pending;
		if (!pending) return;
		clearTimeout(pending.timer);
		this.pending = null;
		this.discardWorker();
		pending.reject(error);
	}

	private discardWorker(): void {
		const worker = this.worker;
		this.worker = null;
		this.known = new Map();
		this.lastOrder = [];
		if (worker) {
			worker.terminate().catch((error: unknown) => logger.warn('snapshot worker terminate failed', error));
		}
	}

	async close(): Promise<void> {
		const worker = this.worker;
		this.worker = null;
		this.known = new Map();
		this.lastOrder = [];
		if (worker) await worker.terminate();
	}
}
