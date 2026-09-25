import { describe, expect, test, vi } from 'vitest';
import { SnapshotCache } from '../src/bl/alerts/snapshotCache';

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => (resolve = r));
	return { promise, resolve };
};

describe('SnapshotCache', () => {
	test('serves the cached snapshot within the TTL — one compute for many gets', async () => {
		const compute = vi.fn(async () => [1, 2, 3]);
		const cache = new SnapshotCache(compute, 60_000);

		const first = await cache.get();
		const second = await cache.get();
		const third = await cache.get();

		expect(compute).toHaveBeenCalledTimes(1);
		expect(second).toBe(first);
		expect(third).toBe(first);
	});

	test('recomputes after the TTL expires', async () => {
		vi.useFakeTimers();
		try {
			const compute = vi.fn(async () => Date.now());
			const cache = new SnapshotCache(compute, 1000);

			await cache.get();
			vi.advanceTimersByTime(1500);
			await cache.get();

			expect(compute).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	test('ttl <= 0 disables caching entirely', async () => {
		const compute = vi.fn(async () => 'x');
		const cache = new SnapshotCache(compute, 0);

		await cache.get();
		await cache.get();

		expect(compute).toHaveBeenCalledTimes(2);
	});

	test('concurrent gets share one in-flight compute instead of stampeding', async () => {
		const gate = deferred<number[]>();
		const compute = vi.fn(() => gate.promise);
		const cache = new SnapshotCache(compute, 60_000);

		const a = cache.get();
		const b = cache.get();
		gate.resolve([42]);

		expect((await a).value).toEqual([42]);
		expect((await b).value).toEqual([42]);
		expect(compute).toHaveBeenCalledTimes(1);
	});

	test('invalidate forces the next get to recompute', async () => {
		let n = 0;
		const compute = vi.fn(async () => ++n);
		const cache = new SnapshotCache(compute, 60_000);

		expect((await cache.get()).value).toBe(1);
		cache.invalidate();
		expect((await cache.get()).value).toBe(2);
	});

	test('a compute already in flight when invalidate lands is not cached', async () => {
		// The UI refetches immediately after every mutation, so "write occurs while a
		// poll-triggered compute is mid-read" is the common case: that compute read the
		// DB before the write and must not be served for a full TTL.
		const gates = [deferred<string>(), deferred<string>()];
		let call = 0;
		const compute = vi.fn(() => gates[call++].promise);
		const cache = new SnapshotCache(compute, 60_000);

		const stale = cache.get();
		cache.invalidate();
		gates[0].resolve('pre-write');
		await stale;

		const fresh = cache.get();
		gates[1].resolve('post-write');
		expect((await fresh).value).toBe('post-write');
		expect(compute).toHaveBeenCalledTimes(2);
	});

	test('a get arriving after invalidate does not join the stale in-flight compute', async () => {
		const gates = [deferred<string>(), deferred<string>()];
		let call = 0;
		const compute = vi.fn(() => gates[call++].promise);
		const cache = new SnapshotCache(compute, 60_000);

		const stale = cache.get();
		cache.invalidate();
		const fresh = cache.get();

		gates[0].resolve('pre-write');
		gates[1].resolve('post-write');

		expect((await stale).value).toBe('pre-write');
		expect((await fresh).value).toBe('post-write');
	});

	test('etag derives from content: unchanged data keeps it, changed data rotates it', async () => {
		let value = ['a'];
		const cache = new SnapshotCache(async () => value, 0);

		const first = await cache.get();
		const same = await cache.get();
		expect(same.etag).toBe(first.etag);

		value = ['b'];
		const changed = await cache.get();
		expect(changed.etag).not.toBe(first.etag);
	});

	test('json is the serialized value, computed once per snapshot', async () => {
		const cache = new SnapshotCache(async () => ({ list: [1, 2] }), 60_000);
		const snapshot = await cache.get();
		expect(JSON.parse(snapshot.json)).toEqual({ list: [1, 2] });
	});

	test('a failed compute is not cached and the next get retries', async () => {
		let fail = true;
		const compute = vi.fn(async () => {
			if (fail) throw new Error('db down');
			return 'recovered';
		});
		const cache = new SnapshotCache(compute, 60_000);

		await expect(cache.get()).rejects.toThrow('db down');
		fail = false;
		expect((await cache.get()).value).toBe('recovered');
	});
});

// markStale(): the webhook path. See the SnapshotCache class comment.
describe('SnapshotCache.markStale (stale-while-revalidate)', () => {
	const nextMacrotask = () => new Promise<void>((resolve) => setImmediate(resolve));

	test('inside the refresh window a stale-marked snapshot is served with no rebuild', async () => {
		let n = 0;
		const compute = vi.fn(async () => ++n);
		const cache = new SnapshotCache(compute, 60_000, 1000);

		expect((await cache.get()).value).toBe(1);
		cache.markStale();
		cache.markStale();
		expect((await cache.get()).value).toBe(1);
		expect(compute).toHaveBeenCalledTimes(1);
	});

	test('past the window a get serves the stale copy once more and rebuilds in the background', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			let n = 0;
			const compute = vi.fn(async () => ++n);
			const cache = new SnapshotCache(compute, 60_000, 1000);

			expect((await cache.get()).value).toBe(1);
			cache.markStale();
			vi.advanceTimersByTime(1500);

			expect((await cache.get()).value).toBe(1); // stale, returned immediately
			await nextMacrotask();
			expect(compute).toHaveBeenCalledTimes(2);
			expect((await cache.get()).value).toBe(2);

			// The rebuilt copy is clean: another window passing without a mark rebuilds nothing.
			vi.advanceTimersByTime(1500);
			expect((await cache.get()).value).toBe(2);
			await nextMacrotask();
			expect(compute).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	test('a storm of polls past the window schedules exactly one rebuild', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			let n = 0;
			const compute = vi.fn(async () => ++n);
			const cache = new SnapshotCache(compute, 60_000, 1000);
			await cache.get();
			cache.markStale();
			vi.advanceTimersByTime(1500);

			const polls = await Promise.all([cache.get(), cache.get(), cache.get(), cache.get(), cache.get()]);
			await nextMacrotask();

			expect(polls.map((p) => p.value)).toEqual([1, 1, 1, 1, 1]);
			expect(compute).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	test('a mark landing during the rebuild keeps the new copy stale, so the next window rebuilds again', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			const gates = [deferred<string>(), deferred<string>(), deferred<string>()];
			let call = 0;
			const compute = vi.fn(() => gates[call++].promise);
			const cache = new SnapshotCache(compute, 60_000, 1000);

			const first = cache.get();
			gates[0].resolve('v1');
			await first;
			cache.markStale();
			vi.advanceTimersByTime(1500);
			await cache.get(); // schedules the background rebuild
			await nextMacrotask(); // rebuild started (gate 1 pending)
			cache.markStale(); // a webhook lands while the rebuild reads the DB
			gates[1].resolve('v2');
			await nextMacrotask();

			expect((await cache.get()).value).toBe('v2'); // newer than v1, so it is served
			vi.advanceTimersByTime(1500);
			await cache.get(); // ...but still marked stale: another rebuild is due
			await nextMacrotask();
			gates[2].resolve('v3');
			await nextMacrotask();
			expect((await cache.get()).value).toBe('v3');
			expect(compute).toHaveBeenCalledTimes(3);
		} finally {
			vi.useRealTimers();
		}
	});

	test('a hard invalidate during a background rebuild discards it; the next get rebuilds inline', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			const gates = [deferred<string>(), deferred<string>(), deferred<string>()];
			let call = 0;
			const compute = vi.fn(() => gates[call++].promise);
			const cache = new SnapshotCache(compute, 60_000, 1000);

			const first = cache.get();
			gates[0].resolve('v1');
			await first;
			cache.markStale();
			vi.advanceTimersByTime(1500);
			await cache.get();
			await nextMacrotask(); // background rebuild in flight (gate 1)
			cache.invalidate(); // a user action
			gates[1].resolve('pre-write');
			await nextMacrotask();

			const fresh = cache.get(); // nothing cached: computes inline, does not join the stale one
			gates[2].resolve('post-write');
			expect((await fresh).value).toBe('post-write');
			expect(compute).toHaveBeenCalledTimes(3);
		} finally {
			vi.useRealTimers();
		}
	});

	test('refreshMs defaults to the TTL, so a mark alone never shortens the cache window', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			let n = 0;
			const compute = vi.fn(async () => ++n);
			const cache = new SnapshotCache(compute, 1000);
			await cache.get();
			cache.markStale();
			vi.advanceTimersByTime(900);
			expect((await cache.get()).value).toBe(1);
			await nextMacrotask();
			expect(compute).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('ifNoneMatchSatisfied', async () => {
	const { ifNoneMatchSatisfied } = await import('../src/utils/etag');
	const etag = '"abc123"';

	test('matches the exact strong validator', () => {
		expect(ifNoneMatchSatisfied('"abc123"', etag)).toBe(true);
	});

	test('matches a weak validator — proxies downgrade ETags when re-compressing', () => {
		expect(ifNoneMatchSatisfied('W/"abc123"', etag)).toBe(true);
		expect(ifNoneMatchSatisfied('w/"abc123"', etag)).toBe(true);
	});

	test('matches within a validator list', () => {
		expect(ifNoneMatchSatisfied('"zzz", W/"abc123", "yyy"', etag)).toBe(true);
	});

	test('star matches any representation', () => {
		expect(ifNoneMatchSatisfied('*', etag)).toBe(true);
	});

	test('no match and no header stay false', () => {
		expect(ifNoneMatchSatisfied('"different"', etag)).toBe(false);
		expect(ifNoneMatchSatisfied(undefined, etag)).toBe(false);
		expect(ifNoneMatchSatisfied('', etag)).toBe(false);
	});
});
