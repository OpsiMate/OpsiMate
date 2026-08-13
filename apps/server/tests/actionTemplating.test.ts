import { beforeAll, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { ALERT_TEMPLATE_VARIABLES } from '@OpsiMate/shared';
import { buildAlertContext, buildSampleContext } from '../src/bl/actions/actionExecutor';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// Template-variable contract of actions AND enrichments (both resolve through
// buildAlertContext): the advertised short variables ({{name}}, {{label.env}}) resolve
// in every context, the alert.*/tag.* aliases keep older templates working, and the
// HTTP action templates its URL and body. The client's picker is built on
// ALERT_TEMPLATE_VARIABLES, so drift here means chips that insert dead variables.

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
	const fullAlert = {
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
	};

	test('every advertised variable resolves to the alert value in the real-alert context', () => {
		const ctx = buildAlertContext(fullAlert);
		for (const variable of ALERT_TEMPLATE_VARIABLES) {
			expect(ctx, `missing ${variable}`).toHaveProperty([variable]);
			expect(ctx[variable], `${variable} resolved empty`).not.toBe('');
		}
		expect(ctx['name']).toBe('CPU high');
		expect(ctx['severity']).toBe('critical');
		expect(ctx['url']).toBe('https://grafana/alert/a-1');
		expect(ctx['label.env']).toBe('prod');
	});

	test('alert.* and tag.* aliases keep older templates resolving', () => {
		const ctx = buildAlertContext(fullAlert);
		expect(ctx['alert.name']).toBe('CPU high');
		expect(ctx['alert.tags.env']).toBe('prod');
		expect(ctx['tag.env']).toBe('prod');
	});

	test('every advertised variable resolves in the Test-button sample context, timestamps chronological', () => {
		const ctx = buildSampleContext();
		for (const variable of ALERT_TEMPLATE_VARIABLES) {
			expect(ctx, `missing ${variable}`).toHaveProperty([variable]);
			expect(ctx[variable], `${variable} resolved empty`).not.toBe('');
		}
		expect(new Date(ctx['createdAt']).getTime()).toBeLessThan(new Date(ctx['updatedAt']).getTime());
		expect(new Date(ctx['startsAt']).getTime()).toBeLessThanOrEqual(new Date(ctx['updatedAt']).getTime());
	});
});

describe('HTTP action templating over the API', () => {
	test('a templated URL is accepted by validation and resolves in preview', async () => {
		const created = await post('/api/v1/actions', {
			name: 'Ack in external system',
			type: 'http',
			config: {
				url: 'https://api.example.com/alerts/{{id}}/ack?sev={{severity}}',
				method: 'POST',
				headers: { 'X-Alert': '{{name}}' },
				bodyTemplate: '{"alert":"{{name}}","tag":"{{label.env}}"}',
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

	test('an alert with null fields previews fine — nulls must not 400 the context schema', async () => {
		const created = await post('/api/v1/actions', {
			name: 'Null-tolerant preview',
			type: 'http',
			config: { url: 'https://api.example.com/x/{{id}}', method: 'POST', bodyTemplate: '{{type}}' },
		});
		// Custom alerts carry type: null (and often null URLs); the details panel sends
		// the alert as-is, so the schema must tolerate every nullable field.
		const preview = await post(`/api/v1/actions/${created.body.data.id}/preview`, {
			alert: {
				id: 'null-1',
				alertName: 'Custom alert',
				type: null,
				summary: null,
				alertUrl: null,
				runbookUrl: null,
			},
		});
		expect(preview.status).toBe(200);
		expect(preview.body.data.url).toBe('https://api.example.com/x/null-1');
		expect(preview.body.data.body).toBe('');
	});

	test('unknown variables stay literal instead of resolving to empty', async () => {
		const created = await post('/api/v1/actions', {
			name: 'Unknown var',
			type: 'http',
			config: {
				url: 'https://api.example.com/x',
				method: 'POST',
				bodyTemplate: '{{nope}}',
			},
		});
		const preview = await post(`/api/v1/actions/${created.body.data.id}/preview`, {
			alert: { alertName: 'x' },
		});
		expect(preview.body.data.body).toBe('{{nope}}');
	});
});
