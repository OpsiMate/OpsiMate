// Bounded LRU for per-query results computed over a snapshot. N clients on the same
// dashboard poll identical queries every few seconds; without this, each poll re-runs
// filter/search/sort over the full snapshot even though the snapshot hasn't changed.
//
// Keys are CONTENT-ADDRESSED: every key embeds the source snapshot's etag (and the
// owners snapshot's, where owners affect the result), so a data change mints new keys
// and stale entries are never served — they simply age out of the LRU. No explicit
// invalidation hook is needed, which is what keeps this safe next to the generation
// dance SnapshotCache has to do.
//
// Values hold references into the snapshot's alert objects, not copies, so an entry
// costs pointers — the capacity below is bytes-cheap even with large pages.
export class QueryResultCache<T> {
	private readonly entries = new Map<string, T>();

	constructor(private readonly capacity: number) {}

	get(key: string): T | undefined {
		const value = this.entries.get(key);
		if (value !== undefined) {
			// Refresh recency: Map iterates in insertion order, so re-inserting moves
			// this key to the back and eviction below stays least-recently-used.
			this.entries.delete(key);
			this.entries.set(key, value);
		}
		return value;
	}

	set(key: string, value: T): void {
		if (this.entries.has(key)) this.entries.delete(key);
		this.entries.set(key, value);
		if (this.entries.size > this.capacity) {
			const oldest = this.entries.keys().next().value;
			if (oldest !== undefined) this.entries.delete(oldest);
		}
	}
}

// Canonical cache-key fragment for a query object: keys sorted recursively so two
// requests that differ only in JSON property order share an entry.
export const stableQueryKey = (value: unknown): string => {
	if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
	if (Array.isArray(value)) return `[${value.map(stableQueryKey).join(',')}]`;
	const record = value as Record<string, unknown>;
	const parts = Object.keys(record)
		.sort()
		.filter((k) => record[k] !== undefined)
		.map((k) => `${JSON.stringify(k)}:${stableQueryKey(record[k])}`);
	return `{${parts.join(',')}}`;
};
