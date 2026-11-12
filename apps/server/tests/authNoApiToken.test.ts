import fs from 'fs';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Role, User } from '@OpsiMate/shared';

// A config file may leave security.api_token out: API-token auth is then off, and the
// Bearer check that runs in front of every JWT verification must not throw on the
// missing value. The config is cached per module graph and tests/setup.ts already loaded
// the default one, so the middleware is re-imported after resetModules() with CONFIG_FILE
// pointing at a file without the token, as config.test.ts does.
type AuthModule = typeof import('../src/middleware/auth');

let tmpRoot: string;
let previousConfigFile: string | undefined;
let auth: AuthModule;

beforeAll(async () => {
	tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-auth-'));
	const file = path.join(tmpRoot, 'config.yml');
	fs.writeFileSync(
		file,
		yaml.dump({
			server: { port: 4477, host: '127.0.0.1' },
			database: { path: path.join(tmpRoot, 'unused.db') },
			security: { private_keys_path: path.join(tmpRoot, 'keys') },
		}),
		'utf8'
	);
	previousConfigFile = process.env.CONFIG_FILE;
	process.env.CONFIG_FILE = file;
	vi.resetModules();
	auth = await import('../src/middleware/auth');
	const { getSecurityConfig } = await import('../src/config/config');
	expect(getSecurityConfig().api_token).toBeUndefined();
});

afterAll(() => {
	if (previousConfigFile === undefined) delete process.env.CONFIG_FILE;
	else process.env.CONFIG_FILE = previousConfigFile;
	vi.resetModules();
	fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('authenticate when the config file has no security.api_token', () => {
	const user: User = {
		id: 'u-1',
		email: 'jwt@test.com',
		fullName: 'JWT User',
		role: Role.Admin,
		createdAt: '2026-01-01T00:00:00.000Z',
	};
	const validJwt = jwt.sign(user, process.env.JWT_SECRET || 'changeme-secret');

	const guardedApp = () => {
		const app = express();
		app.get('/user', auth.authenticateJWT, (_req, res) => res.json({ success: true }));
		return app;
	};

	test('a valid JWT still signs in', async () => {
		const res = await request(guardedApp()).get('/user').set('Authorization', `Bearer ${validJwt}`);
		expect(res.status).toBe(200);
	});

	test('a non-JWT Bearer value is a 401, not a crash', async () => {
		const res = await request(guardedApp()).get('/user').set('Authorization', 'Bearer opsimate');
		expect(res.status).toBe(401);
	});

	test('x-api-token is refused as well', async () => {
		const res = await request(guardedApp()).get('/user').set('x-api-token', 'opsimate');
		expect(res.status).toBe(401);
	});
});
