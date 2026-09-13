import { beforeAll, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import { getAppVersionInfo } from '../src/api/health';
import { setupDB, setupExpressApp } from './setup';

describe('GET /version', () => {
	let app: SuperTest<Test>;
	beforeAll(async () => {
		app = await setupExpressApp(await setupDB());
	});

	test('is unauthenticated and reports "dev" when nothing is baked in', async () => {
		const res = await app.get('/version');
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.version).toBe('dev');
	});

	test('/health keeps its plain "ok" contract (container probes depend on it)', async () => {
		const res = await app.get('/health');
		expect(res.status).toBe(200);
		expect(res.text).toBe('ok');
	});
});

describe('getAppVersionInfo', () => {
	test('reads the baked build identity from the environment', () => {
		expect(
			getAppVersionInfo({ APP_VERSION: '0.0.110', APP_COMMIT: 'abc123', APP_BUILD_DATE: '2026-09-06T09:18:52Z' })
		).toEqual({ version: '0.0.110', commit: 'abc123', buildDate: '2026-09-06T09:18:52Z' });
	});
	test('blank values fall back to dev / null, never empty strings', () => {
		expect(getAppVersionInfo({ APP_VERSION: '  ', APP_COMMIT: '', APP_BUILD_DATE: undefined })).toEqual({
			version: 'dev',
			commit: null,
			buildDate: null,
		});
	});
});
