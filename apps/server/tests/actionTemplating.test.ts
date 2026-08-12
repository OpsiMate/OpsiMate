import { beforeAll, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { ALERT_TEMPLATE_VARIABLES } from '@OpsiMate/shared';
import { buildAlertContext, buildSampleContext } from '../src/bl/actions/actionExecutor';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// Template-variable contract of actions: the advertised variable list resolves in every
// context, and the HTTP action templates its URL and body (the client's picker is built
// on ALERT_TEMPLATE_VARIABLES, so drift here means chips that insert dead variables).

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const post = (url: string, body: object) => app.post(url).set('Authorization', `Bearer ${jwtToken}`).send(body);

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

describe('alert template variables', () => {
	test('every advertised variable resolves in the real-alert context', () => {
		const ctx = buildAlertContext({
			id: 'a-1',
			alertName: 'CPU high',
			status: 'firing',
			type: 'grafana',
			severity: 'critical',
			summary: 'CPU above 90%',
			startsAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-02T00:00:00Z',
			createdAt: '2026-01-01T00:00:00Z',
			alertUrl: 'https://grafana/alert/a-1',
			runbookUrl: 'https://runbooks/cpu',
			tags: { service: 'api', env: 'prod' },
		});
		for (const variable of ALERT_TEMPLATE_VARIABLES) {
			expect(ctx, `missing ${variable}`).toHaveProperty([variable]);
		}
		expect(ctx['alert.tags.env']).toBe('prod');
	});

	test('every advertised variable resolves in the Test-button sample context', () => {
		const ctx = buildSampleContext();
		for (const variable of ALERT_TEMPLATE_VARIABLES) {
			expect(ctx, `missing ${variable}`).toHaveProperty([variable]);
		}
	});
});

describe('HTTP action templating over the API', () => {
	test('a templated URL is accepted by validation and resolves in preview', async () => {
		const created = await post('/api/v1/actions', {
			name: 'Ack in external system',
			type: 'http',
			config: {
				url: 'https://api.example.com/alerts/{{alert.id}}/ack?sev={{alert.severity}}',
				method: 'POST',
				headers: { 'X-Alert': '{{alert.name}}' },
				bodyTemplate: '{"alert":"{{alert.name}}","tag":"{{alert.tags.env}}"}',
			},
		});
		expect(created.status).toBe(201);
		const actionId = created.body.data.id;

		const preview = await post(`/api/v1/actions/${actionId}/preview`, {
			alert: {
				id: 'abc-123',
				alertName: 'Disk full',
				status: 'firing',
				severity: 'critical',
				tags: { env: 'prod' },
			},
		});
		expect(preview.status).toBe(200);
		expect(preview.body.data.url).toBe('https://api.example.com/alerts/abc-123/ack?sev=critical');
		expect(preview.body.data.body).toBe('{"alert":"Disk full","tag":"prod"}');
	});

	test('unknown variables stay literal instead of resolving to empty', async () => {
		const created = await post('/api/v1/actions', {
			name: 'Unknown var',
			type: 'http',
			config: {
				url: 'https://api.example.com/x',
				method: 'POST',
				bodyTemplate: '{{alert.nope}}',
			},
		});
		const preview = await post(`/api/v1/actions/${created.body.data.id}/preview`, {
			alert: { alertName: 'x' },
		});
		expect(preview.body.data.body).toBe('{{alert.nope}}');
	});
});
