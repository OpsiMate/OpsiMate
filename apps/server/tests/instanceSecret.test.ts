import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { readOrCreateInstanceSecret } from '../src/utils/instanceSecret';

// A generated instance secret: made once, kept, private, never silently replaced.

describe('readOrCreateInstanceSecret', () => {
	let dir: string;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-secret-'));
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test('the first call writes 32 random bytes as hex, readable only by the owner', () => {
		const first = readOrCreateInstanceSecret(dir, 'jwt-secret');
		expect(first.created).toBe(true);
		expect(first.secret).toMatch(/^[0-9a-f]{64}$/);
		expect(first.file).toBe(path.join(dir, 'jwt-secret'));
		expect(fs.readFileSync(first.file, 'utf8').trim()).toBe(first.secret);
		if (process.platform !== 'win32') expect(fs.statSync(first.file).mode & 0o777).toBe(0o600);
		// Only the secret is left behind, no temporary file.
		expect(fs.readdirSync(dir)).toEqual(['jwt-secret']);
	});

	test('later calls, in this process or another, return the same value', () => {
		const first = readOrCreateInstanceSecret(dir, 'jwt-secret');
		const again = readOrCreateInstanceSecret(dir, 'jwt-secret');
		expect(again).toEqual({ ...first, created: false });
	});

	test('each name is its own secret, and each install its own value', () => {
		const jwt = readOrCreateInstanceSecret(dir, 'jwt-secret');
		const encryption = readOrCreateInstanceSecret(dir, 'encryption-key');
		expect(jwt.secret).not.toBe(encryption.secret);
		const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-secret-'));
		try {
			expect(readOrCreateInstanceSecret(otherDir, 'jwt-secret').secret).not.toBe(jwt.secret);
		} finally {
			fs.rmSync(otherDir, { recursive: true, force: true });
		}
	});

	test('a missing directory is created', () => {
		const nested = path.join(dir, 'data', 'database');
		expect(readOrCreateInstanceSecret(nested, 'jwt-secret').created).toBe(true);
		expect(fs.existsSync(path.join(nested, 'jwt-secret'))).toBe(true);
	});

	test('a key file someone opened up (a recursive chmod) is made owner-only again on the next read', () => {
		const first = readOrCreateInstanceSecret(dir, 'jwt-secret');
		fs.chmodSync(first.file, 0o777);
		expect(readOrCreateInstanceSecret(dir, 'jwt-secret').secret).toBe(first.secret);
		if (process.platform !== 'win32') expect(fs.statSync(first.file).mode & 0o777).toBe(0o600);
	});

	test('a file written by someone else (a restore, an operator) is used as it is', () => {
		const restored = 'ab'.repeat(32);
		fs.writeFileSync(path.join(dir, 'jwt-secret'), `${restored}\n`);
		expect(readOrCreateInstanceSecret(dir, 'jwt-secret')).toMatchObject({ secret: restored, created: false });
	});

	test.each([
		['empty', ''],
		['too short', 'ab'.repeat(31)],
		['not hex', 'z'.repeat(64)],
	])('a damaged file (%s) is an error and is left untouched, never replaced', (_case, content) => {
		const file = path.join(dir, 'jwt-secret');
		fs.writeFileSync(file, content);
		expect(() => readOrCreateInstanceSecret(dir, 'jwt-secret', { settleMs: 100 })).toThrow(
			/does not hold a usable secret/
		);
		expect(fs.readFileSync(file, 'utf8')).toBe(content);
	});

	test('a file another process is still writing (no hard links: empty, then complete) is waited for', () => {
		const file = path.join(dir, 'jwt-secret');
		const theirs = 'cd'.repeat(32);
		fs.writeFileSync(file, '');
		// A separate process finishes the write while this one waits (the wait blocks this
		// thread, so the writer has to live elsewhere).
		const writer = spawn(process.execPath, [
			'-e',
			`setTimeout(() => require('fs').writeFileSync(${JSON.stringify(file)}, '${theirs}\\n'), 300)`,
		]);
		try {
			expect(readOrCreateInstanceSecret(dir, 'jwt-secret', { settleMs: 5000 })).toEqual({
				secret: theirs,
				file,
				created: false,
			});
		} finally {
			writer.kill();
		}
	});
});
