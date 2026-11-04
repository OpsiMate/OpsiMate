import { QueryClient } from '@tanstack/react-query';
import { describe, expect, test } from 'vitest';
import { Alert, AlertGroupSummaryNode } from '@OpsiMate/shared';
import {
	applyToAlertCaches,
	removeAlertsFromCache,
	restoreAlertCaches,
	updateAlertsInCache,
} from '@/hooks/queries/alerts/alertListCache';
import { ownerMovesBetween, shiftOwnerSummaries } from '@/hooks/queries/alerts/ownerSummaryCache';

// The split-by-owner pane counts read the server's owner group summaries. When an
// optimistic update moves rows between owners, those counts must move at the same time
// — not a round-trip and a refetch later.

const alert = (id: string, ownerId: string | null = null): Alert => ({ id, ownerId }) as Alert;
const node = (value: string, count: number): AlertGroupSummaryNode => ({
	key: `root:${encodeURIComponent(value)}`,
	field: 'owner',
	value,
	count,
	status: 'firing',
	level: 0,
	children: [],
});
const counts = (nodes: AlertGroupSummaryNode[] | undefined) =>
	Object.fromEntries((nodes ?? []).map((n) => [n.value, n.count]));

const listKey = ['alerts', 'api', { sort: 'startsAt' }] as const;
const otherListKey = ['alerts', 'api', { sort: 'severity' }] as const;
const ownerSummariesKey = ['alerts', 'groups', 'active', ['owner'], null, null, null, null] as const;
const nestedOwnerSummariesKey = ['alerts', 'groups', 'active', ['owner', 'severity'], null, null, null, null] as const;
const severitySummariesKey = ['alerts', 'groups', 'active', ['severity'], null, null, null, null] as const;
const resolvedOwnerSummariesKey = ['alerts', 'groups', 'resolved', ['owner'], null, null, null, null] as const;

const seed = () => {
	const client = new QueryClient();
	const alerts = [alert('a'), alert('b'), alert('c', '1')];
	client.setQueryData(listKey, { pages: [{ alerts, total: 3 }], pageParams: [undefined] });
	// A second list holding the same alerts: each alert must count once.
	client.setQueryData(otherListKey, {
		pages: [{ alerts: [...alerts].reverse(), total: 3 }],
		pageParams: [undefined],
	});
	client.setQueryData(['users'], [{ id: '1', fullName: 'Idan QA' }]);
	client.setQueryData(ownerSummariesKey, [node('Idan QA', 1), node('Unassigned', 2)]);
	client.setQueryData(nestedOwnerSummariesKey, [node('Idan QA', 1), node('Unassigned', 2)]);
	client.setQueryData(severitySummariesKey, [{ ...node('critical', 3), field: 'severity' }]);
	client.setQueryData(resolvedOwnerSummariesKey, [node('Unassigned', 5)]);
	return client;
};

describe('ownerMovesBetween', () => {
	test('reads each alert once across lists; unchanged owners are not moves', () => {
		const client = seed();
		const snapshot = client.getQueriesData({ queryKey: ['alerts'] });
		const moves = ownerMovesBetween(
			snapshot,
			updateAlertsInCache(new Set(['a', 'c']), (a) => ({ ...a, ownerId: '1' }))
		);
		expect([...moves]).toEqual([['a', { from: null, to: '1' }]]);
	});

	test('an alert the updater drops from the lists leaves its bucket', () => {
		const client = seed();
		const snapshot = client.getQueriesData({ queryKey: ['alerts'] });
		const moves = ownerMovesBetween(snapshot, removeAlertsFromCache(new Set(['c'])));
		expect([...moves]).toEqual([['c', { from: '1', to: undefined }]]);
	});
});

describe('shiftOwnerSummaries', () => {
	const nameOf = (ownerId: string | null) =>
		ownerId === null ? 'Unassigned' : ownerId === '1' ? 'Idan QA' : `User ${ownerId}`;

	test('moves counts between buckets, drops an emptied one, adds a new owner', () => {
		const nodes = [node('Idan QA', 1), node('Unassigned', 2)];
		expect(counts(shiftOwnerSummaries(nodes, [{ from: null, to: '1' }], nameOf))).toEqual({
			'Idan QA': 2,
			Unassigned: 1,
		});
		expect(counts(shiftOwnerSummaries(nodes, [{ from: '1', to: null }], nameOf))).toEqual({ Unassigned: 3 });
		expect(counts(shiftOwnerSummaries(nodes, [{ from: null, to: '7' }], nameOf))).toEqual({
			'Idan QA': 1,
			Unassigned: 1,
			'User 7': 1,
		});
	});

	test('no net change returns the same array', () => {
		const nodes = [node('Unassigned', 2)];
		expect(shiftOwnerSummaries(nodes, [], nameOf)).toBe(nodes);
	});
});

describe('applyToAlertCaches shifts the owner summaries with the rows', () => {
	test('assigning two unowned alerts moves them to the owner, under both owner groupings only', async () => {
		const client = seed();
		const snapshot = await applyToAlertCaches(
			client,
			['alerts'],
			updateAlertsInCache(new Set(['a', 'b']), (a) => ({ ...a, ownerId: '1' }))
		);
		expect(counts(client.getQueryData(ownerSummariesKey))).toEqual({ 'Idan QA': 3 });
		expect(counts(client.getQueryData(nestedOwnerSummariesKey))).toEqual({ 'Idan QA': 3 });
		expect(counts(client.getQueryData(severitySummariesKey))).toEqual({ critical: 3 });
		expect(counts(client.getQueryData(resolvedOwnerSummariesKey))).toEqual({ Unassigned: 5 });
		// Rolling back puts the counts back with the rows.
		restoreAlertCaches(client, snapshot);
		expect(counts(client.getQueryData(ownerSummariesKey))).toEqual({ 'Idan QA': 1, Unassigned: 2 });
	});

	test('resolving an unowned alert takes it out of the Unassigned count', async () => {
		const client = seed();
		await applyToAlertCaches(client, ['alerts'], removeAlertsFromCache(new Set(['a'])));
		expect(counts(client.getQueryData(ownerSummariesKey))).toEqual({ 'Idan QA': 1, Unassigned: 1 });
	});

	test('changes under the resolved-alerts prefix leave the active summaries alone', async () => {
		const client = seed();
		client.setQueryData(['resolvedAlerts', { sort: 'startsAt' }], {
			pages: [{ alerts: [alert('r')] }],
			pageParams: [],
		});
		await applyToAlertCaches(
			client,
			['resolvedAlerts'],
			updateAlertsInCache(new Set(['r']), (a) => ({ ...a, ownerId: '1' }))
		);
		expect(counts(client.getQueryData(ownerSummariesKey))).toEqual({ 'Idan QA': 1, Unassigned: 2 });
	});
});
