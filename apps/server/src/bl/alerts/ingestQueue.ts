// Coalesces individual writes into batches. The webhook ingest path is the reason
// this exists: every source POSTs one alert per request, and on a single-threaded
// server with a synchronous SQLite driver each request used to cost its own
// transaction (its own fsync) plus a full snapshot invalidation. Under a burst of a
// few thousand alerts a second that pinned the one core and starved the UI's polls
// (see PR #1028 for the measurements). Batching turns N requests that arrive within
// one flush window into ONE transaction and ONE invalidation, and lets the event
// loop breathe between flushes.
//
// Semantics callers can rely on:
// - enqueue() resolves only after the item's batch is committed, so "POST then GET"
//   still observes the write (the HTTP response waits for the flush).
// - A batch that fails as a whole is retried item by item, so one bad row rejects
//   only its own promise; the others still land.
// - drain() waits until nothing is pending or in flight — write paths that must
//   observe every earlier ingest (resolve, unresolve, delete-forever, bulk) call it
//   first, so an ingest that arrived a millisecond before a resolve is committed
//   before the resolve runs.

export interface IngestQueueOptions {
	// How long to wait after the first enqueue before flushing (more arrivals in that
	// window join the batch). 0 (the default) flushes on the next macrotask: measured
	// against a 10ms timer it batches just as well under load (avg ~10 rows at 4.7k/s)
	// and costs a sequential sender nothing (2ms/POST vs 12ms).
	flushMs: number;
	// Flush immediately once this many items are waiting, regardless of the timer.
	maxBatch: number;
}

interface PendingItem<TItem, TResult> {
	item: TItem;
	resolve: (result: TResult) => void;
	reject: (error: unknown) => void;
}

export class IngestQueue<TItem, TResult> {
	private pending: PendingItem<TItem, TResult>[] = [];
	private timer: NodeJS.Timeout | NodeJS.Immediate | null = null;
	private inflight: Promise<void> | null = null;

	constructor(
		private readonly flushBatch: (items: TItem[]) => Promise<TResult[]>,
		private readonly options: IngestQueueOptions
	) {
		// A non-positive or NaN maxBatch would make splice() remove nothing and run()
		// spin forever on the first enqueue — with a synchronous flush that never yields,
		// which freezes the whole process. Refuse it here rather than at 3 a.m.
		if (!Number.isInteger(options.maxBatch) || options.maxBatch < 1) {
			throw new Error(`IngestQueue: maxBatch must be a positive integer, got ${String(options.maxBatch)}`);
		}
		if (!Number.isFinite(options.flushMs)) {
			throw new Error(`IngestQueue: flushMs must be a finite number, got ${String(options.flushMs)}`);
		}
	}

	get size(): number {
		return this.pending.length;
	}

	enqueue(item: TItem): Promise<TResult> {
		return new Promise<TResult>((resolve, reject) => {
			this.pending.push({ item, resolve, reject });
			if (this.pending.length >= this.options.maxBatch) {
				void this.flush();
			} else if (this.timer === null) {
				// flushMs <= 0: flush on the next macrotask (setImmediate), so an idle server
				// adds no latency while a busy one still gathers everything parsed in the
				// current tick. A timer only makes sense to trade latency for bigger batches.
				this.timer =
					this.options.flushMs > 0
						? setTimeout(() => void this.flush(), this.options.flushMs)
						: setImmediate(() => void this.flush());
			}
		});
	}

	// Commits everything waiting, in batches of maxBatch. Concurrent callers share the
	// same in-flight run; items enqueued while a run is active are picked up by its
	// loop, so nothing is ever left behind a completed flush.
	flush(): Promise<void> {
		if (this.timer !== null) {
			if (this.options.flushMs > 0) clearTimeout(this.timer as NodeJS.Timeout);
			else clearImmediate(this.timer as NodeJS.Immediate);
			this.timer = null;
		}
		if (this.inflight === null) {
			this.inflight = this.run().finally(() => {
				this.inflight = null;
			});
		}
		return this.inflight;
	}

	async drain(): Promise<void> {
		do {
			await this.flush();
		} while (this.pending.length > 0 || this.inflight !== null);
	}

	private async run(): Promise<void> {
		while (this.pending.length > 0) {
			const batch = this.pending.splice(0, this.options.maxBatch);
			try {
				const results = await this.flushBatch(batch.map((entry) => entry.item));
				batch.forEach((entry, index) => entry.resolve(results[index]));
			} catch {
				// Isolate the failure: re-run one at a time so only the offending items
				// reject. The batch already rolled back as a unit, so nothing is applied twice.
				for (const entry of batch) {
					try {
						const [result] = await this.flushBatch([entry.item]);
						entry.resolve(result);
					} catch (error) {
						entry.reject(error);
					}
				}
			}
		}
	}
}
