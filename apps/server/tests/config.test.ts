import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

// loadConfig() is the whole boot-time configuration surface: the port, the database path,
// the SSH-key folder, whether sudo is tried, and whether email is on at all. It reads the
// YAML file named by CONFIG_FILE, or falls back to built-in defaults — and one of those
// fallbacks is a safety rule, not a convenience: a mailer declared `enabled: true` without
// a complete SMTP setup is switched back off, so a half-configured install sends no mail
// instead of failing at the first send. None of it was covered (only the ldap section is,
// in ldapAuthenticator.test.ts), so this file pins the defaults, the validation, the
// mailer rule and the module-level cache that the rest of the server then reads.

// Every variable this module reads. The tests clear them first because a value left over
// from the developer's shell or from vitest's own env would silently change an assertion.
const MANAGED_ENV_KEYS = [
	'CONFIG_FILE',
	'SERVER_HOST',
	'API_TOKEN',
	'VM_TRY_WITH_SUDO',
	'EMAIL_ENABLED',
	'SMTP_HOST',
	'SMTP_PORT',
	'SMTP_FROM',
	'SMTP_USER',
	'SMTP_PASS',
	'APP_BASE_URL',
];

type ConfigModule = typeof import('../src/config/config');

let tmpRoot: string;
let envSnapshot: Record<string, string | undefined>;
let fileIndex = 0;

// The config is cached in a module-level variable and tests/setup.ts already loads it, so a
// test cannot see its own env by calling the copy the app imported. Re-importing after
// resetModules() hands each test a fresh cache — which is also what a new process does.
const freshConfig = async (): Promise<ConfigModule> => {
	vi.resetModules();
	return await import('../src/config/config');
};

const writeConfigFile = (config: Record<string, unknown>): string => {
	const file = path.join(tmpRoot, `config-${fileIndex++}.yml`);
	fs.writeFileSync(file, yaml.dump(config), 'utf8');
	return file;
};

// A file with just the three required fields, at values that differ from the defaults, so
// asserting them proves the file was read rather than the fallbacks used.
const validFile = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
	server: { port: 4477, host: '127.0.0.1' },
	database: { path: 'data/from-file.db' },
	security: { private_keys_path: 'keys/from-file' },
	...overrides,
});

const completeMailer = (): Record<string, unknown> => ({
	enabled: true,
	host: 'smtp.example.com',
	port: 587,
	auth: { user: 'smtp-user', pass: 'smtp-pass' },
});

const expectDefaults = (config: import('../src/config/config').OpsimateConfig) => {
	expect(config.server.port).toBe(3001);
	expect(config.database.path).toBe('../../data/database/opsimate.db');
	expect(config.security.private_keys_path).toBe('../../data/private-keys');
	expect(config.vm.try_with_sudo).toBe(true);
};

beforeAll(() => {
	tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-config-'));
});

beforeEach(() => {
	envSnapshot = {};
	for (const key of MANAGED_ENV_KEYS) {
		envSnapshot[key] = process.env[key];
		delete process.env[key];
	}
});

afterEach(() => {
	for (const key of MANAGED_ENV_KEYS) {
		if (envSnapshot[key] === undefined) delete process.env[key];
		else process.env[key] = envSnapshot[key];
	}
	vi.resetModules();
});

afterAll(() => {
	fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('the built-in defaults', () => {
	test('no CONFIG_FILE at all falls back to every default', async () => {
		const { loadConfig } = await freshConfig();
		expectDefaults(loadConfig());
	});

	test('a CONFIG_FILE that does not exist gives the same defaults instead of throwing', async () => {
		process.env.CONFIG_FILE = path.join(tmpRoot, 'definitely-not-written.yml');

		const { loadConfig } = await freshConfig();
		expect(() => loadConfig()).not.toThrow();
		expectDefaults(loadConfig());
	});

	test('VM_TRY_WITH_SUDO=false turns sudo attempts off in the default config', async () => {
		process.env.VM_TRY_WITH_SUDO = 'false';

		const { loadConfig } = await freshConfig();
		expect(loadConfig().vm.try_with_sudo).toBe(false);
	});

	test('server.host is SERVER_HOST when set, 0.0.0.0 otherwise', async () => {
		expect((await freshConfig()).loadConfig().server.host).toBe('0.0.0.0');

		process.env.SERVER_HOST = '127.0.0.1';
		expect((await freshConfig()).loadConfig().server.host).toBe('127.0.0.1');
	});
});

describe('a config file', () => {
	test('the values it sets are the values returned', async () => {
		process.env.CONFIG_FILE = writeConfigFile(validFile());

		const { loadConfig } = await freshConfig();
		const config = loadConfig();
		expect(config.server.port).toBe(4477);
		expect(config.server.host).toBe('127.0.0.1');
		expect(config.database.path).toBe('data/from-file.db');
		expect(config.security.private_keys_path).toBe('keys/from-file');
	});

	test.each(['server.port', 'database.path', 'security.private_keys_path'] as const)(
		'a file missing %s is rejected',
		async (missing) => {
			const [section, field] = missing.split('.');
			const file = structuredClone(validFile());
			delete (file[section] as Record<string, unknown>)[field];
			process.env.CONFIG_FILE = writeConfigFile(file);

			const { loadConfig } = await freshConfig();
			expect(() => loadConfig()).toThrow('Invalid config file');
		}
	);

	test('a file with no vm section still tries sudo, and only an explicit false stops it', async () => {
		process.env.CONFIG_FILE = writeConfigFile(validFile());
		expect((await freshConfig()).loadConfig().vm).toEqual({ try_with_sudo: true });

		process.env.VM_TRY_WITH_SUDO = 'false';
		expect((await freshConfig()).loadConfig().vm.try_with_sudo).toBe(false);
	});

	test('a vm section in the file wins over the environment', async () => {
		process.env.CONFIG_FILE = writeConfigFile(validFile({ vm: { try_with_sudo: true } }));
		process.env.VM_TRY_WITH_SUDO = 'false';

		const { loadConfig } = await freshConfig();
		expect(loadConfig().vm.try_with_sudo).toBe(true);
	});
});

describe('the mailer fallback', () => {
	test('no mailer section means no email', async () => {
		process.env.CONFIG_FILE = writeConfigFile(validFile());

		const { loadConfig, isEmailEnabled } = await freshConfig();
		expect(loadConfig().mailer).toEqual({ enabled: false });
		expect(isEmailEnabled()).toBe(false);
	});

	test('a complete mailer stays enabled', async () => {
		process.env.CONFIG_FILE = writeConfigFile(validFile({ mailer: completeMailer() }));

		const { loadConfig, isEmailEnabled } = await freshConfig();
		expect(loadConfig().mailer?.enabled).toBe(true);
		expect(isEmailEnabled()).toBe(true);
	});

	test.each(['host', 'port', 'auth.user', 'auth.pass'] as const)(
		'enabled: true without %s is switched off rather than left to fail on send',
		async (missing) => {
			const mailer = structuredClone(completeMailer());
			const auth = mailer.auth as Record<string, unknown>;
			if (missing.startsWith('auth.')) delete auth[missing.slice('auth.'.length)];
			else delete mailer[missing];
			process.env.CONFIG_FILE = writeConfigFile(validFile({ mailer }));

			const { loadConfig, isEmailEnabled } = await freshConfig();
			expect(loadConfig().mailer?.enabled).toBe(false);
			expect(isEmailEnabled()).toBe(false);
		}
	);
});

describe('the module-level cache', () => {
	test('every call returns the same object, even after CONFIG_FILE moves', async () => {
		process.env.CONFIG_FILE = writeConfigFile(validFile({ server: { port: 4001 } }));
		const config = await freshConfig();

		const first = config.loadConfig();
		expect(config.loadConfig()).toBe(first);

		process.env.CONFIG_FILE = writeConfigFile(validFile({ server: { port: 4002 } }));
		expect(config.loadConfig()).toBe(first);
		expect(config.loadConfig().server.port).toBe(4001);
	});

	test('a fresh module reads the new file', async () => {
		process.env.CONFIG_FILE = writeConfigFile(validFile({ server: { port: 4001 } }));
		expect((await freshConfig()).loadConfig().server.port).toBe(4001);

		process.env.CONFIG_FILE = writeConfigFile(validFile({ server: { port: 4002 } }));
		const reloaded = await freshConfig();
		expect(reloaded.loadConfig().server.port).toBe(4002);
	});
});
