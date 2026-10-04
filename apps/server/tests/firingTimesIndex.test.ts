import { describe, expect, test } from 'vitest';
import { AlertHistoryEventType } from '@OpsiMate/shared';
import { FiringTimesIndex, FiringRecord, UnresolveRecord } from '../src/bl/alerts/firingTimesIndex';

// In-memory stand-ins for the two history tables, with the same append-only ids the
// real ones have, so the index's incremental reads can be checked call by call.
class FakeHistory {
	rows: FiringRecord[] = [];
	calls: string[] = [];
	private nextId = 1;
	fire(alertId: string, archivedAt: string): void {
		this.rows.push({ history_id: this.nextId++, alert_id: alertId, archived_at: archivedAt });
	}
	async getFiringTimesByAlert(alertIds: string[]): Promise<Record<string, string[]>> {
		this.calls.push(`byAlert:${alertIds.join(',')}`);
		const wanted = new Set(alertIds);
		const out: Record<string, string[]> = {};
		for (const r of this.rows) if (wanted.has(r.alert_id)) (out[r.alert_id] ??= []).push(r.archived_at);
		return Promise.resolve(out);
	}
	async getFiringRowsAfter(historyId: number): Promise<FiringRecord[]> {
		this.calls.push(`after:${historyId}`);
		return Promise.resolve(this.rows.filter((r) => r.history_id > historyId));
	}
	async getMaxHistoryId(): Promise<number> {
		return Promise.resolve(this.rows.length ? this.rows[this.rows.length - 1].history_id : 0);
	}
}

class FakeEvents {
	rows: UnresolveRecord[] = [];
	private nextId = 1;
	unresolve(alertId: string, createdAt: string): void {
		this.rows.push({ id: this.nextId++, alert_id: alertId, created_at: createdAt });
	}
	async getEventTimesByType(eventType: string, alertIds: string[]): Promise<Record<string, string[]>> {
		expect(eventType).toBe(AlertHistoryEventType.UNRESOLVED);
		const wanted = new Set(alertIds);
		const out: Record<string, string[]> = {};
		for (const r of this.rows) if (wanted.has(r.alert_id)) (out[r.alert_id] ??= []).push(r.created_at);
		return Promise.resolve(out);
	}
	async getEventsOfTypeAfter(_eventType: string, id: number): Promise<UnresolveRecord[]> {
		return Promise.resolve(this.rows.filter((r) => r.id > id));
	}
	async getMaxEventId(): Promise<number> {
		return Promise.resolve(this.rows.length ? this.rows[this.rows.length - 1].id : 0);
	}
}

const build = () => {
	const history = new FakeHistory();
	const events = new FakeEvents();
	let now = 1_000_000;
	const index = new FiringTimesIndex(history, events, 60_000, () => now);
	return { history, events, index, advance: (ms: number) => (now += ms) };
};

describe('FiringTimesIndex', () => {
	test('first refresh loads everything; the next one reads only past the high-water mark', async () => {
		const { history, index } = build();
		history.fire('a', '2026-01-01 10:00:00');
		history.fire('b', '2026-01-01 11:00:00');

		const first = await index.refresh(['a', 'b']);
		expect(first.get('a')).toEqual(['2026-01-01T10:00:00.000Z']);
		expect(first.get('b')).toEqual(['2026-01-01T11:00:00.000Z']);
		expect(history.calls).toEqual(['byAlert:a,b']);

		history.calls = [];
		await index.refresh(['a', 'b']);
		expect(history.calls).toEqual(['after:2']); // nothing new: one cheap indexed read, no per-alert work
	});

	test('an unchanged alert keeps the same array across refreshes (identity), a changed one gets a new one', async () => {
		const { history, index } = build();
		history.fire('a', '2026-01-01 10:00:00');
		history.fire('b', '2026-01-01 10:00:00');
		const before = await index.refresh(['a', 'b']);
		const aBefore = before.get('a');
		const bBefore = before.get('b');

		history.fire('b', '2026-01-02 10:00:00');
		const after = await index.refresh(['a', 'b']);
		expect(after.get('a')).toBe(aBefore);
		expect(after.get('b')).not.toBe(bBefore);
		expect(after.get('b')).toEqual(['2026-01-01T10:00:00.000Z', '2026-01-02T10:00:00.000Z']);
	});

	test('an alert that becomes active later has its OLD history loaded, not just rows past the mark', async () => {
		const { history, index } = build();
		history.fire('a', '2026-01-01 10:00:00');
		history.fire('c', '2026-01-01 09:00:00'); // c exists in history but is not active yet
		await index.refresh(['a']);

		history.fire('a', '2026-01-03 10:00:00');
		const times = await index.refresh(['a', 'c']); // c re-fires / is restored
		expect(times.get('c')).toEqual(['2026-01-01T09:00:00.000Z']);
		expect(times.get('a')).toEqual(['2026-01-01T10:00:00.000Z', '2026-01-03T10:00:00.000Z']);
		expect(history.calls.at(-1)).toBe('byAlert:c'); // targeted read for the newcomer only
	});

	test('unresolve events merge with firing records, deduped and sorted', async () => {
		const { history, events, index } = build();
		history.fire('a', '2026-01-01 10:00:00');
		events.unresolve('a', '2026-01-01T09:00:00.000Z');
		events.unresolve('a', '2026-01-01T10:00:00.000Z'); // same instant as the firing record
		const times = await index.refresh(['a']);
		expect(times.get('a')).toEqual(['2026-01-01T09:00:00.000Z', '2026-01-01T10:00:00.000Z']);
	});

	test('ids that left the active list are evicted; alerts with no history have no entry', async () => {
		const { history, index } = build();
		history.fire('a', '2026-01-01 10:00:00');
		expect((await index.refresh(['a', 'quiet'])).has('quiet')).toBe(false);
		const later = await index.refresh(['quiet']);
		expect(later.has('a')).toBe(false);
		expect(later.size).toBe(0);
	});

	test('rows appended for inactive alerts still advance the mark and are not kept', async () => {
		const { history, index } = build();
		await index.refresh(['a']);
		history.fire('resolved-one', '2026-01-01 10:00:00');
		history.fire('a', '2026-01-01 11:00:00');
		const times = await index.refresh(['a']);
		expect(times.has('resolved-one')).toBe(false);
		expect(times.get('a')).toEqual(['2026-01-01T11:00:00.000Z']);
		history.calls = [];
		await index.refresh(['a']);
		expect(history.calls).toEqual(['after:2']);
	});

	test('deleted rows are only seen by a full reload: after the reload interval, or on reset()', async () => {
		const { history, index, advance } = build();
		history.fire('a', '2026-01-01 10:00:00');
		history.fire('a', '2026-01-02 10:00:00');
		await index.refresh(['a']);
		history.rows = history.rows.filter((r) => r.archived_at !== '2026-01-01 10:00:00'); // retention purge

		expect((await index.refresh(['a'])).get('a')).toHaveLength(2); // incremental read cannot see a delete
		advance(60_001);
		expect((await index.refresh(['a'])).get('a')).toEqual(['2026-01-02T10:00:00.000Z']);

		history.rows = [];
		expect((await index.refresh(['a'])).get('a')).toHaveLength(1);
		index.reset();
		expect((await index.refresh(['a'])).has('a')).toBe(false);
	});

	test('a full reload keeps the array identity of alerts whose times did not change', async () => {
		const { history, index, advance } = build();
		history.fire('a', '2026-01-01 10:00:00');
		const before = (await index.refresh(['a'])).get('a');
		advance(60_001);
		expect((await index.refresh(['a'])).get('a')).toBe(before);
	});
});
