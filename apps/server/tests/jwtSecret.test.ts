import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { JWT_SECRET_FILE, resolveJwtSecret } from '../src/utils/jwtSecret';

// The login session key: JWT_SECRET when set (and long enough), otherwise the one this
// install generated for itself. Never a value that ships in the repo.

describe('resolveJwtSecret', () => {
	let dir: string;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-jwt-'));
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test.each([
		['the old public fallback', 'changeme-secret'],
		['31 bytes', 'x'.repeat(31)],
		['31 bytes padded with spaces', `  ${'x'.repeat(31)}  `],
	])('a JWT_SECRET that is set but %s is refused, not replaced by a generated one', (_case, value) => {
		expect(() => resolveJwtSecret({ JWT_SECRET: value }, dir)).toThrow(/shorter than 32 bytes/);
		expect(fs.existsSync(path.join(dir, JWT_SECRET_FILE))).toBe(false);
	});

	test('a JWT_SECRET of 32 bytes or more is used as given, and nothing is written', () => {
		const secret = 'x'.repeat(32);
		expect(resolveJwtSecret({ JWT_SECRET: secret }, dir)).toEqual({ secret, source: 'env' });
		expect(fs.readdirSync(dir)).toEqual([]);
	});

	test.each([
		['unset', {}],
		['empty', { JWT_SECRET: '' }],
		['whitespace only', { JWT_SECRET: '   ' }],
	])('%s: the install generates its own, once, and keeps using it', (_case, env) => {
		const first = resolveJwtSecret(env, dir);
		expect(first.source).toBe('generated');
		expect(first.secret).toMatch(/^[0-9a-f]{64}$/);
		const again = resolveJwtSecret(env, dir);
		expect(again).toEqual({ ...first, source: 'file' });
	});

	test('a JWT_SECRET set later wins over the generated one', () => {
		resolveJwtSecret({}, dir);
		const secret = 'y'.repeat(40);
		expect(resolveJwtSecret({ JWT_SECRET: secret }, dir).secret).toBe(secret);
	});
});
