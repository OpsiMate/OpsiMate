import crypto from 'crypto';

export interface Snapshot<T> {
	value: T;
	// The value serialized once at compute time, so N pollers per tick cost one
	// JSON.stringify, not N.
	json: string;
	// Content-derived (not time-derived), so an unchanged list keeps its ETag across
	// recomputes and If-None-Match keeps producing 304s.
	etag: string;
}

// Read-through cache for the alerts list. Every client polls the same endpoint on a
// short interval and the response is identical for all of them, yet it was recomputed
// per request — full table scan, every enrichment rule, every mute policy. One compute
// per TTL window serves every poller in it.
//
// The TTL is also the staleness bound for writes this process never sees: background
// sync runs in a separate worker process, so its DB writes can't reach invalidate().
// Same-process writes shouldn't wait out the TTL — the UI refetches immediately after
// a mutation — which is what invalidate() is for.
//
// ttlMs <= 0 disables caching (every get() recomputes) but keeps the json/etag shape;
// the test environment uses this so seed-directly-then-read tests stay valid.
export class SnapshotCache<T> {
	private cached: { snapshot: Snapshot<T>; computedAt: number } | null = null;
	private inflight: { promise: Promise<Snapshot<T>>; generation: number } | null = null;
	// Bumped by invalidate(). A compute that started under an older generation read the
	// DB before the invalidating write, so its result must not be cached — and readers
	// arriving after the invalidate must not join it — otherwise a mutation landing
	// mid-compute stays invisible despite invalidating (the UI refetches immediately
	// after every mutation, so this race is the common case, not the corner).
	private generation = 0;

	constructor(
		private readonly compute: () => Promise<T>,
		private readonly ttlMs: number
	) {}

	async get(): Promise<Snapshot<T>> {
		if (this.cached && Date.now() - this.cached.computedAt < this.ttlMs) {
			return this.cached.snapshot;
		}
		// Concurrent pollers share one compute instead of stampeding — but only a
		// current-generation one; a pre-invalidate compute would hand them stale data.
		if (this.inflight && this.inflight.generation === this.generation) {
			return this.inflight.promise;
		}
		const startedGeneration = this.generation;
		const entry = {
			generation: startedGeneration,
			promise: this.compute().then((value) => {
				const json = JSON.stringify(value);
				const snapshot: Snapshot<T> = {
					value,
					json,
					etag: `"${crypto.createHash('sha1').update(json).digest('hex')}"`,
				};
				if (this.ttlMs > 0 && this.generation === startedGeneration) {
					this.cached = { snapshot, computedAt: Date.now() };
				}
				return snapshot;
			}),
		};
		entry.promise
			.finally(() => {
				if (this.inflight === entry) {
					this.inflight = null;
				}
			})
			// This side-chain must not surface as an unhandled rejection when compute
			// fails; callers observe entry.promise itself.
			.catch(() => undefined);
		this.inflight = entry;
		return entry.promise;
	}

	invalidate(): void {
		this.generation++;
		this.cached = null;
	}
}
