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
