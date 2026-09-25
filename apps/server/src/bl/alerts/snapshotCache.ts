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
// Two kinds of write reach the cache, and they get different treatment:
//
// - invalidate(): a user action (resolve, silence, rule edit). The UI refetches
//   immediately and must see it, so the cached snapshot is dropped and the next get()
//   rebuilds inline.
// - markStale(): a webhook batch landed. Nobody is waiting on that specific write, and
//   under a storm they land thousands of times a second — invalidating on each one
//   made every poll a full rebuild (~300ms of main-thread CPU at ~50k alerts), which
//   with a handful of open tabs is more CPU than there is: the "OpsiMate feels stuck"
//   symptom. So a stale snapshot keeps being served, and once it is refreshMs old the
//   next get() hands it out one more time and rebuilds in the background. The
//   staleness a poller can observe is bounded by refreshMs plus one rebuild, and the
//   rebuild rate is bounded by 1/refreshMs however hard the webhooks come.
//
// ttlMs <= 0 disables caching (every get() recomputes) but keeps the json/etag shape;
// the test environment uses this so seed-directly-then-read tests stay valid.
interface CachedSnapshot<T> {
	snapshot: Snapshot<T>;
	computedAt: number;
	// Set by markStale(): a write this copy does not reflect has landed.
	staleSince: number | null;
}

interface InflightCompute<T> {
	promise: Promise<Snapshot<T>>;
	generation: number;
}

export class SnapshotCache<T> {
	private cached: CachedSnapshot<T> | null = null;
	private inflight: InflightCompute<T> | null = null;
	// Bumped by invalidate(). A compute that started under an older generation read the
	// DB before the invalidating write, so its result must not be cached — and readers
	// arriving after the invalidate must not join it — otherwise a mutation landing
	// mid-compute stays invisible despite invalidating (the UI refetches immediately
	// after every mutation, so this race is the common case, not the corner).
	private generation = 0;
	// Bumped by markStale(). A compute that started before a mark read the DB before
	// that write: its result is cached (it is newer than what it replaces) but stays
	// marked stale, so the next refresh window rebuilds again.
	private staleMarks = 0;
	private refreshScheduled = false;

	constructor(
		private readonly compute: () => Promise<T>,
		private readonly ttlMs: number,
		// How old a stale-marked snapshot may get before a get() triggers a background
		// rebuild. Defaults to the TTL, i.e. markStale() behaves like a plain TTL wait.
		private readonly refreshMs: number = ttlMs
	) {}

	async get(): Promise<Snapshot<T>> {
		const now = Date.now();
		if (this.cached && now - this.cached.computedAt < this.ttlMs) {
			if (this.cached.staleSince !== null && now - this.cached.computedAt >= this.refreshMs) {
				this.refreshInBackground();
			}
			return this.cached.snapshot;
		}
		return this.startCompute();
	}

	// Serve-stale path: the caller already holds a snapshot to answer with; the rebuild
	// runs on the next macrotask so the response goes out first. The synchronous SQLite
	// driver means the rebuild still blocks the loop for its duration — the point is
	// how often that happens, not where.
	private refreshInBackground(): void {
		if (this.refreshScheduled || (this.inflight && this.inflight.generation === this.generation)) return;
		this.refreshScheduled = true;
		setImmediate(() => {
			this.refreshScheduled = false;
			// A hard invalidate or a completed refresh in the meantime makes this moot.
			if (!this.cached || this.cached.staleSince === null) return;
			// Errors surface on the next inline compute; here there is nobody to tell,
			// and the stale snapshot keeps being served.
			this.startCompute().catch(() => undefined);
		});
	}

	private startCompute(): Promise<Snapshot<T>> {
		// Concurrent pollers share one compute instead of stampeding — but only a
		// current-generation one; a pre-invalidate compute would hand them stale data.
		if (this.inflight && this.inflight.generation === this.generation) {
			return this.inflight.promise;
		}
		const startedGeneration = this.generation;
		const startedStaleMarks = this.staleMarks;
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
					this.cached = {
						snapshot,
						computedAt: Date.now(),
						staleSince: this.staleMarks === startedStaleMarks ? null : Date.now(),
					};
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

	// A write landed that this snapshot does not reflect, but nobody is waiting on it:
	// keep serving the copy and rebuild at most once per refresh window. See the class
	// comment for why webhooks take this path and user actions do not.
	markStale(): void {
		this.staleMarks++;
		if (this.cached && this.cached.staleSince === null) {
			this.cached.staleSince = Date.now();
		}
	}
}
