import { beforeAll, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { formatAlertTimestampDisplay, formatAlertTimestampFull } from '@OpsiMate/shared';
import { buildAlertContext, buildSampleContext, resolvePlaceholders } from '../src/bl/actions/actionExecutor';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// {{startsAt.display}} says what the alerts table showed the sender: a bare clock for
// today's alerts, the full date otherwise, in the sender's zone and locale. {{startsAt}}
// stays the exact ISO instant.

describe('formatAlertTimestampDisplay', () => {
	const viewer = { timeZone: 'Asia/Jerusalem', locale: 'en-US' };

	test("today (in the viewer's zone) is a 24-hour clock; another day carries the date", () => {
		const now = new Date('2026-10-20T22:30:00Z'); // 01:30 on Oct 21 in Jerusalem
		expect(formatAlertTimestampDisplay('2026-10-20T21:15:53Z', viewer, now)).toBe('00:15:53');
		// 20:15 UTC on Oct 20 is still Oct 20 in Jerusalem (23:15) — a different day than the viewer's "today".
		expect(formatAlertTimestampDisplay('2026-10-20T20:15:53Z', viewer, now)).toBe('10/20/2026, 23:15:53');
		expect(formatAlertTimestampFull('2026-10-20T21:15:53Z', viewer)).toBe('10/21/2026, 00:15:53');
	});

	test('midnight is 00, never 24; the locale orders the date; an unknown zone falls back instead of failing', () => {
		const now = new Date('2026-10-20T12:00:00Z');
		expect(formatAlertTimestampDisplay('2026-10-20T00:00:05Z', { timeZone: 'UTC', locale: 'en-US' }, now)).toBe(
			'00:00:05'
		);
		expect(formatAlertTimestampFull('2026-10-20T15:04:05Z', { timeZone: 'UTC', locale: 'en-GB' })).toBe(
			'20/10/2026, 15:04:05'
		);
		expect(
			formatAlertTimestampFull('2026-10-20T15:04:05Z', { timeZone: 'Not/AZone', locale: 'xx-INVALID' })
		).toMatch(/2026/);
		expect(formatAlertTimestampDisplay('garbage', viewer, now)).toBe('');
	});
});

describe('action context', () => {
	const alert = {
		id: 'a-1',
		alertName: 'Disk full',
		startsAt: '2026-10-20T21:15:53Z',
		updatedAt: '2026-10-20T21:20:00Z',
		createdAt: '2026-10-19T08:00:00Z',
	};

	test('carries the display timestamps for the viewer, the ISO ones untouched', () => {
		const ctx = buildAlertContext(alert, { timeZone: 'UTC', locale: 'en-US' });
		expect(ctx['startsAt']).toBe('2026-10-20T21:15:53Z');
		expect(ctx['startsAt.display']).toBe('10/20/2026, 21:15:53');
		expect(ctx['alert.createdAt.display']).toBe('10/19/2026, 08:00:00');
		expect(resolvePlaceholders('{{name}} since {{startsAt.display}}', ctx)).toBe(
			'Disk full since 10/20/2026, 21:15:53'
		);
		// The sample used by "Send test" has them too, so a template with them tests cleanly.
		expect(buildSampleContext({ timeZone: 'UTC', locale: 'en-US' })['updatedAt.display']).toMatch(
			/^\d\d:\d\d:\d\d$/
		);
	});
});

describe('over the API', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	let jwt: string;

	beforeAll(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
		jwt = await setupUserWithToken(app);
	});

	test("the preview renders {{startsAt.display}} in the viewer's zone sent with the request", async () => {
		const created = await app
			.post('/api/v1/actions')
			.set('Authorization', `Bearer ${jwt}`)
			.send({
				name: 'Display time',
				type: 'http',
				config: {
					url: 'https://example.com',
					method: 'POST',
					bodyTemplate: '{{startsAt.display}} | {{startsAt}}',
				},
			});
		expect(created.status).toBe(201);
		const preview = await app
			.post(`/api/v1/actions/${created.body.data.id}/preview`)
			.set('Authorization', `Bearer ${jwt}`)
			.send({
				alert: { id: 'x', alertName: 'X', startsAt: '2026-01-05T15:04:05Z' },
				viewer: { timeZone: 'Asia/Jerusalem', locale: 'en-US' },
			});
		expect(preview.status).toBe(200);
		expect(preview.body.data.body).toBe('01/05/2026, 17:04:05 | 2026-01-05T15:04:05Z');
	});
});
