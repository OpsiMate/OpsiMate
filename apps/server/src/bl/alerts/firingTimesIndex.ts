import { AlertHistoryEventType } from '@OpsiMate/shared';
import { toIsoUtc } from '../../utils/time';

// The per-alert firing timestamps the alerts list carries (status-history "firing"
// records plus UNRESOLVED events), kept between snapshot rebuilds instead of rebuilt
// from scratch each time. Both source tables are append-only with AUTOINCREMENT ids
// (retention is the exception, below), so after one full load a rebuild only reads
// what was appended past the high-water marks — usually nothing — plus the history of
// alerts that just became active. At 50k alerts the from-scratch version was the single
// largest piece of the rebuild: not the SQL, the per-alert normalize/dedupe/sort.
//
// Arrays are shared by reference and replaced, never mutated, so an unchanged alert
// keeps the same array across rebuilds — AlertBL uses that identity to skip work.
//
// Deletes (the retention job, in another process) cannot be seen incrementally; a
// full reload every fullReloadMs bounds how long a purged timestamp can linger, and
// reset() forces one.

export interface FiringRecord {
	history_id: number;
	alert_id: string;
	archived_at: string;
}

export interface UnresolveRecord {
	id: number;
	alert_id: string;
	created_at: string;
}

export interface FiringHistorySource {
	getFiringTimesByAlert(alertIds: string[]): Promise<Record<string, string[]>>;
	getFiringRowsAfter(historyId: number): Promise<FiringRecord[]>;
	getMaxHistoryId(): Promise<number>;
}

export interface UnresolveEventSource {
	getEventTimesByType(eventType: string, alertIds: string[]): Promise<Record<string, string[]>>;
	getEventsOfTypeAfter(eventType: string, id: number): Promise<UnresolveRecord[]>;
	getMaxEventId(): Promise<number>;
}

const sortedUnique = (values: string[]): string[] => [...new Set(values)].sort();

const sameList = (a: string[] | undefined, b: string[]): boolean =>
	a !== undefined && a.length === b.length && a.every((value, i) => value === b[i]);

export class FiringTimesIndex {
	// Only ids with at least one timestamp; the list omits the property otherwise.
	private times = new Map<string, string[]>();
	// Ids whose history has been loaded (even if it was empty).
	private known = new Set<string>();
	private historyMark = 0;
	private eventMark = 0;
	private fullLoadedAt = Number.NEGATIVE_INFINITY;
	// Refreshes run one at a time: two interleaved ones would race on the map (the
	// older one's eviction loop can drop ids the newer one just loaded).
	private refreshQueue: Promise<unknown> = Promise.resolve();

	constructor(
		private readonly history: FiringHistorySource,
		private readonly events: UnresolveEventSource,
		private readonly fullReloadMs = 60_000,
		private readonly now: () => number = () => Date.now()
	) {}

	// The current map for exactly these ids: ids that left are evicted, ids that
	// arrived are loaded, everything else is brought up to the appended rows.
	refresh(activeIds: string[]): Promise<ReadonlyMap<string, string[]>> {
		const run = this.refreshQueue.then(() => this.refreshNow(activeIds));
		this.refreshQueue = run.catch(() => undefined);
		return run;
	}

	private async refreshNow(activeIds: string[]): Promise<ReadonlyMap<string, string[]>> {
		if (this.now() - this.fullLoadedAt >= this.fullReloadMs) {
			await this.fullLoad(activeIds);
			return this.times;
		}
		const active = new Set(activeIds);
		const newIds = activeIds.filter((id) => !this.known.has(id));
		// Marks are advanced from the rows actually read, never from a separate MAX():
		// a row committed by another process between two statements is then picked up
		// by the next refresh instead of being skipped for good.
		const [appendedFiring, appendedEvents, newFiring, newEvents] = await Promise.all([
			this.history.getFiringRowsAfter(this.historyMark),
			this.events.getEventsOfTypeAfter(AlertHistoryEventType.UNRESOLVED, this.eventMark),
			newIds.length > 0
				? this.history.getFiringTimesByAlert(newIds)
				: Promise.resolve<Record<string, string[]>>({}),
			newIds.length > 0
				? this.events.getEventTimesByType(AlertHistoryEventType.UNRESOLVED, newIds)
				: Promise.resolve<Record<string, string[]>>({}),
		]);

		const additions = new Map<string, string[]>();
		const add = (id: string, raw: string) => {
			if (!active.has(id)) return;
			const list = additions.get(id);
			if (list) list.push(raw);
			else additions.set(id, [raw]);
		};
		for (const id of newIds) {
			this.known.add(id);
			for (const raw of newFiring[id] ?? []) add(id, raw);
			for (const raw of newEvents[id] ?? []) add(id, raw);
		}
		for (const row of appendedFiring) {
			add(row.alert_id, row.archived_at);
			this.historyMark = row.history_id;
		}
		for (const row of appendedEvents) {
			add(row.alert_id, row.created_at);
			this.eventMark = row.id;
		}
		for (const [id, raw] of additions) {
			const merged = sortedUnique([...(this.times.get(id) ?? []), ...raw.map(toIsoUtc)]);
			if (!sameList(this.times.get(id), merged)) this.times.set(id, merged);
		}
		for (const id of this.known) {
			if (!active.has(id)) {
				this.known.delete(id);
				this.times.delete(id);
			}
		}
		return this.times;
	}

	// Next refresh reloads everything — for callers that know rows were deleted.
	reset(): void {
		this.fullLoadedAt = Number.NEGATIVE_INFINITY;
	}

	private async fullLoad(activeIds: string[]): Promise<void> {
		// Marks before rows (see refresh): anything appended in between is re-read next
		// time and deduplicated, rather than lost.
		const [historyMark, eventMark] = await Promise.all([
			this.history.getMaxHistoryId(),
			this.events.getMaxEventId(),
		]);
		const [firing, unresolves] =
			activeIds.length > 0
				? await Promise.all([
						this.history.getFiringTimesByAlert(activeIds),
						this.events.getEventTimesByType(AlertHistoryEventType.UNRESOLVED, activeIds),
					])
				: [{}, {}];
		const next = new Map<string, string[]>();
		for (const id of activeIds) {
			const merged = sortedUnique([...(firing[id] ?? []), ...(unresolves[id] ?? [])].map(toIsoUtc));
			if (merged.length === 0) continue;
			const previous = this.times.get(id);
			next.set(id, sameList(previous, merged) && previous ? previous : merged);
		}
		this.times = next;
		this.known = new Set(activeIds);
		this.historyMark = historyMark;
		this.eventMark = eventMark;
		this.fullLoadedAt = this.now();
	}
}
