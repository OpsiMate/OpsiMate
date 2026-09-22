import { beforeAll, describe, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { AlertHistoryRepository } from '../src/dal/alertHistoryRepository';
import { setupDB, setupExpressApp } from './setup';
import { AlertHistoryEventType } from '@OpsiMate/shared';

let db: Database.Database;
let repository: AlertHistoryRepository;

beforeAll(async () => {
	db = await setupDB();
	await setupExpressApp(db);
	repository = new AlertHistoryRepository(db);
});

describe('AlertHistoryRepository', () => {
	test('recordEvent stores an ISO-8601 UTC timestamp', async () => {
		await repository.recordEvent({
			alertId: 'alert-1',
			eventType: AlertHistoryEventType.COMMENT_ADDED,
		});

		const rows = await repository.getEvents('alert-1');

		expect(rows).toHaveLength(1);
		expect(rows[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
	});

	test('recordEvent stores nullable fields as null', async () => {
		await repository.recordEvent({
			alertId: 'alert-2',
			eventType: AlertHistoryEventType.COMMENT_ADDED,
		});

		const rows = await repository.getEvents('alert-2');

		expect(rows[0].actor_name).toBeNull();
		expect(rows[0].description).toBeNull();
	});

	test('getEvents returns events newest first', async () => {
		await repository.recordEvent({
			alertId: 'alert-3',
			eventType: AlertHistoryEventType.COMMENT_ADDED,
			description: 'First event',
		});

		await new Promise((resolve) => setTimeout(resolve, 5));

		await repository.recordEvent({
			alertId: 'alert-3',
			eventType: AlertHistoryEventType.UPDATED,
			description: 'Second event',
		});

		const rows = await repository.getEvents('alert-3');

		expect(rows).toHaveLength(2);
		expect(rows[0].description).toBe('Second event');
		expect(rows[1].description).toBe('First event');
	});

	test('getEvents only returns events for the requested alert', async () => {
		await repository.recordEvent({
			alertId: 'alert-4',
			eventType: AlertHistoryEventType.COMMENT_ADDED,
			description: 'Matching event',
		});

		await repository.recordEvent({
			alertId: 'alert-5',
			eventType: AlertHistoryEventType.COMMENT_ADDED,
			description: 'Other alert',
		});

		const rows = await repository.getEvents('alert-4');

		expect(rows).toHaveLength(1);
		expect(rows[0].description).toBe('Matching event');
	});

	test('getEventTimesByType groups matching events by alert', async () => {
		await repository.recordEvent({
			alertId: 'alert-6',
			eventType: AlertHistoryEventType.UNRESOLVED,
		});

		await repository.recordEvent({
			alertId: 'alert-6',
			eventType: AlertHistoryEventType.UNRESOLVED,
		});

		await repository.recordEvent({
			alertId: 'alert-7',
			eventType: AlertHistoryEventType.UNRESOLVED,
		});

		await repository.recordEvent({
			alertId: 'alert-6',
			eventType: AlertHistoryEventType.COMMENT_ADDED,
		});

		const alert6Events = await repository.getEvents('alert-6');
		const alert7Events = await repository.getEvents('alert-7');

		const result = await repository.getEventTimesByType(AlertHistoryEventType.UNRESOLVED, ['alert-6', 'alert-7']);

		expect(result).toHaveProperty('alert-6');
		expect(result).toHaveProperty('alert-7');
		expect(result['alert-6']).toEqual(
			alert6Events
				.filter((event) => event.event_type === AlertHistoryEventType.UNRESOLVED)
				.map((event) => event.created_at)
		);
		expect(result['alert-7']).toEqual(
			alert7Events
				.filter((event) => event.event_type === AlertHistoryEventType.UNRESOLVED)
				.map((event) => event.created_at)
		);
	});

	test('getEventTimesByType returns an empty object for no alert IDs', async () => {
		const result = await repository.getEventTimesByType(AlertHistoryEventType.UNRESOLVED, []);

		expect(result).toEqual({});
	});

	test('getAllEventTimes returns all event times with actor names', async () => {
		await repository.recordEvent({
			alertId: 'alert-8',
			eventType: AlertHistoryEventType.COMMENT_ADDED,
			actorName: 'Alice',
		});

		await repository.recordEvent({
			alertId: 'alert-9',
			eventType: AlertHistoryEventType.UPDATED,
			actorName: 'Bob',
		});

		const alert8Events = await repository.getEvents('alert-8');
		const alert9Events = await repository.getEvents('alert-9');

		const rows = await repository.getAllEventTimes();

		const matchingRows = rows.filter((row) => ['alert-8', 'alert-9'].includes(row.alert_id));

		expect(matchingRows).toHaveLength(2);
		expect(matchingRows).toContainEqual(
			expect.objectContaining({
				alert_id: 'alert-8',
				actor_name: 'Alice',
				created_at: alert8Events[0].created_at,
			})
		);
		expect(matchingRows).toContainEqual(
			expect.objectContaining({
				alert_id: 'alert-9',
				actor_name: 'Bob',
				created_at: alert9Events[0].created_at,
			})
		);
	});

	test('getEvents returns an empty array for an unknown alert', async () => {
		const rows = await repository.getEvents('alert-does-not-exist');

		expect(rows).toEqual([]);
	});
});
