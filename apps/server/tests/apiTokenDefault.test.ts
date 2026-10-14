import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Regression coverage for security.api_token's default. The maintainer's call (PR
// #1025 review): keep the shipped 'opsimate' fallback for now, since removing it
// outright breaks every deployment still relying on it, but make it impossible to
// run on that default unnoticed. That second part is warnIfDefaultApiToken in
// config.ts, covered in its own describe block below. Isolated from the rest of the
// suite (no ./setup import) so it controls config.ts's env-derived, module-cached
// default directly, instead of the value every other test file's eager
// `secrets/router.ts` import already froze.
describe('API-token default when no API_TOKEN is configured', () => {
	const originalToken = process.env.API_TOKEN;

	beforeEach(() => {
		delete process.env.API_TOKEN;
		vi.resetModules();
	});

	afterEach(() => {
		if (originalToken === undefined) {
			delete process.env.API_TOKEN;
		} else {
			process.env.API_TOKEN = originalToken;
		}
		vi.resetModules();
	});

	async function buildApp(): Promise<Express> {
		const { authenticateJWT } = await import('../src/middleware/auth.ts');
		const app = express();
		app.get('/protected', authenticateJWT, (_req, res) => res.status(200).json({ success: true }));
		return app;
	}

	test('the shipped default token authenticates when nothing overrides it', async () => {
		const { DEFAULT_API_TOKEN } = await import('../src/config/config.ts');
		const app = await buildApp();
		const res = await request(app).get('/protected').set('x-api-token', DEFAULT_API_TOKEN);
		expect(res.status).toBe(200);
	});

	test('a token that is not the default and not configured is rejected', async () => {
		const app = await buildApp();
		for (const candidate of ['', 'undefined', 'null', 'some-other-value']) {
			const res = await request(app).get('/protected').set('x-api-token', candidate);
			expect(res.status, `candidate ${JSON.stringify(candidate)}`).toBe(401);
		}
	});

	test('a request with no credentials at all is still rejected the same way', async () => {
		const app = await buildApp();
		const res = await request(app).get('/protected');
		expect(res.status).toBe(401);
	});
});

describe('API-token auth once an operator sets a real token', () => {
	const originalToken = process.env.API_TOKEN;

	beforeEach(() => {
		process.env.API_TOKEN = 'a-real-operator-chosen-token';
		vi.resetModules();
	});

	afterEach(() => {
		if (originalToken === undefined) {
			delete process.env.API_TOKEN;
		} else {
			process.env.API_TOKEN = originalToken;
		}
		vi.resetModules();
	});

	test('the configured token authenticates', async () => {
		const { authenticateJWT } = await import('../src/middleware/auth.ts');
		const app = express();
		app.get('/protected', authenticateJWT, (_req, res) => res.status(200).json({ success: true }));

		const res = await request(app).get('/protected').set('x-api-token', 'a-real-operator-chosen-token');
		expect(res.status).toBe(200);
	});

	test('the shipped default is not treated as a fallback match once a real token is set', async () => {
		const { authenticateJWT } = await import('../src/middleware/auth.ts');
		const app = express();
		app.get('/protected', authenticateJWT, (_req, res) => res.status(200).json({ success: true }));

		const { DEFAULT_API_TOKEN } = await import('../src/config/config.ts');
		const res = await request(app).get('/protected').set('x-api-token', DEFAULT_API_TOKEN);
		expect(res.status).toBe(401);
	});
});

// A mounted config.yml is the documented docker-compose path. loadConfig() used to read
// API_TOKEN only in the no-config-file branch, so an operator following the "set
// API_TOKEN" advice above got silently ignored once they had a config file mounted.
describe('API_TOKEN still overrides a mounted config file', () => {
	const originalToken = process.env.API_TOKEN;
	const originalConfigFile = process.env.CONFIG_FILE;
	let configPath: string;

	beforeEach(() => {
		configPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-config-')), 'config.yml');
		fs.writeFileSync(
			configPath,
			[
				'server:',
				'  port: 3001',
				'  host: "0.0.0.0"',
				'database:',
				'  path: "/tmp/opsimate.db"',
				'security:',
				'  private_keys_path: "/tmp/private-keys"',
				'  api_token: "from-the-mounted-file"',
			].join('\n')
		);
		process.env.CONFIG_FILE = configPath;
		process.env.API_TOKEN = 'from-the-env-var';
		vi.resetModules();
	});

	afterEach(() => {
		if (originalToken === undefined) {
			delete process.env.API_TOKEN;
		} else {
			process.env.API_TOKEN = originalToken;
		}
		if (originalConfigFile === undefined) {
			delete process.env.CONFIG_FILE;
		} else {
			process.env.CONFIG_FILE = originalConfigFile;
		}
		fs.rmSync(path.dirname(configPath), { recursive: true, force: true });
		vi.resetModules();
	});

	test('API_TOKEN wins over the value written in the mounted file', async () => {
		const { getSecurityConfig } = await import('../src/config/config.ts');
		expect(getSecurityConfig().api_token).toBe('from-the-env-var');
	});

	// docker-compose passes API_TOKEN through as `${API_TOKEN:-}`, so an unset host
	// variable reaches the container as an empty string. That must not clobber the
	// token in the mounted file.
	test('an empty API_TOKEN leaves the mounted file token in place', async () => {
		process.env.API_TOKEN = '';
		const { getSecurityConfig } = await import('../src/config/config.ts');
		expect(getSecurityConfig().api_token).toBe('from-the-mounted-file');
	});
});

// The startup warning is the actual safeguard now that the default token fallback
// stays in place: it can't stop the default from working, but a deployment running
// on it should be unmissable in the logs.
describe('startup warning for the default api_token', () => {
	const originalToken = process.env.API_TOKEN;
	const originalConfigFile = process.env.CONFIG_FILE;
	let configPath: string;
	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		delete process.env.API_TOKEN;
		delete process.env.CONFIG_FILE;
		vi.resetModules();
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		if (originalToken === undefined) {
			delete process.env.API_TOKEN;
		} else {
			process.env.API_TOKEN = originalToken;
		}
		if (originalConfigFile === undefined) {
			delete process.env.CONFIG_FILE;
		} else {
			process.env.CONFIG_FILE = originalConfigFile;
		}
		if (configPath) {
			fs.rmSync(path.dirname(configPath), { recursive: true, force: true });
		}
		warnSpy.mockRestore();
		vi.resetModules();
	});

	test('warns when no config file and no API_TOKEN leave the effective token at the default', async () => {
		const { getSecurityConfig } = await import('../src/config/config.ts');
		getSecurityConfig();
		const warned = warnSpy.mock.calls.some((call) =>
			String(call[0]).includes('security.api_token is set to the default value')
		);
		expect(warned).toBe(true);
	});

	test('does not warn once API_TOKEN sets a real token', async () => {
		process.env.API_TOKEN = 'a-real-operator-chosen-token';
		const { getSecurityConfig } = await import('../src/config/config.ts');
		getSecurityConfig();
		const warned = warnSpy.mock.calls.some((call) =>
			String(call[0]).includes('security.api_token is set to the default value')
		);
		expect(warned).toBe(false);
	});

	test('warns when a mounted config file itself still carries the default token', async () => {
		configPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-config-')), 'config.yml');
		fs.writeFileSync(
			configPath,
			[
				'server:',
				'  port: 3001',
				'  host: "0.0.0.0"',
				'database:',
				'  path: "/tmp/opsimate.db"',
				'security:',
				'  private_keys_path: "/tmp/private-keys"',
				'  api_token: "opsimate"',
			].join('\n')
		);
		process.env.CONFIG_FILE = configPath;
		const { getSecurityConfig } = await import('../src/config/config.ts');
		getSecurityConfig();
		const warned = warnSpy.mock.calls.some((call) =>
			String(call[0]).includes('security.api_token is set to the default value')
		);
		expect(warned).toBe(true);
	});

	test('does not warn when a mounted config file sets a different token', async () => {
		configPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-config-')), 'config.yml');
		fs.writeFileSync(
			configPath,
			[
				'server:',
				'  port: 3001',
				'  host: "0.0.0.0"',
				'database:',
				'  path: "/tmp/opsimate.db"',
				'security:',
				'  private_keys_path: "/tmp/private-keys"',
				'  api_token: "a-real-operator-chosen-token"',
			].join('\n')
		);
		process.env.CONFIG_FILE = configPath;
		const { getSecurityConfig } = await import('../src/config/config.ts');
		getSecurityConfig();
		const warned = warnSpy.mock.calls.some((call) =>
			String(call[0]).includes('security.api_token is set to the default value')
		);
		expect(warned).toBe(false);
	});
});
