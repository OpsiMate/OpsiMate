import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { describe, expect, test } from 'vitest';

// The YAML files we ship must parse, or the server dies at startup before it can log
// anything useful. That is not hypothetical: the js-yaml 4 -> 5 bump made the parser
// spec-strict, and default-config.yml — the file docker-entrypoint.sh falls back to
// when no config is mounted — had a multi-line flow mapping whose closing brace sat at
// its key's indent. Every Docker user without a mounted config crashed on upgrade with
// "deficient indentation", and nothing in the suite noticed.
//
// That happened twice. #854 reverted js-yaml to 4.x and reformatted the shipped files
// to block style; dependabot #879 bumped it back to 5.x eight days later and 0.0.108
// shipped the crash again. These tests stayed green through it, because reformatting
// our own files is exactly what makes them parse under the strict parser.
//
// So the cases below split in two:
//   - the shipped configs, which we control and keep in block style, and
//   - a fixture in the OLD format, which we do NOT control. Users' configs are mounted
//     into the container, so an image upgrade never rewrites them. Any parser we ship
//     has to keep reading them, and that is the case a version bump can actually break.

const repoRoot = path.resolve(__dirname, '../../..');

interface ShippedConfig {
	// Repo-relative path, so a failure names the file directly.
	file: string;
	// Keys loadConfig() requires; a config that parses but lacks these is equally fatal.
	requiredPaths: string[][];
}

const SHIPPED_CONFIGS: ShippedConfig[] = [
	{
		file: 'default-config.yml',
		requiredPaths: [
			['server', 'port'],
			['database', 'path'],
			['security', 'private_keys_path'],
		],
	},
	{
		file: 'configuration_example/docker-config.yml',
		requiredPaths: [
			['server', 'port'],
			['database', 'path'],
			['security', 'private_keys_path'],
		],
	},
];
// Deliberately not listed: apps/server/local-config.yml is gitignored — a developer's
// own file, not something we ship, so it doesn't exist on CI.

const readAtPath = (root: unknown, keys: string[]): unknown =>
	keys.reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], root);

describe('shipped YAML configs', () => {
	test.each(SHIPPED_CONFIGS)(
		'$file parses and carries the fields loadConfig() requires',
		({ file, requiredPaths }) => {
			const absolute = path.join(repoRoot, file);
			expect(fs.existsSync(absolute), `${file} is missing`).toBe(true);

			const parsed = yaml.load(fs.readFileSync(absolute, 'utf8'));
			expect(parsed, `${file} parsed to nothing`).toBeTruthy();

			for (const keys of requiredPaths) {
				// Truthy, not merely defined: loadConfig() guards with `!config.server?.port`,
				// so null / '' / 0 are just as fatal at startup as the key being absent.
				expect(readAtPath(parsed, keys), `${file} is missing ${keys.join('.')}`).toBeTruthy();
			}
		}
	);

	// Pins the specific shape that broke: a flow mapping is only valid here when its
	// braces stay on one line, or its continuation lines are indented past the key.
	test('no config opens a flow mapping at the end of a line', () => {
		for (const { file } of SHIPPED_CONFIGS) {
			const lines = fs.readFileSync(path.join(repoRoot, file), 'utf8').split('\n');
			lines.forEach((line, index) => {
				const withoutComment = line.split('#')[0].trimEnd();
				expect(
					withoutComment.endsWith('{'),
					`${file}:${index + 1} opens a multi-line flow mapping; use block style`
				).toBe(false);
			});
		}
	});

	// The case that #879 slipped past. This fixture is a user config in the pre-#854
	// format; it is deliberately NOT in SHIPPED_CONFIGS, because the flow-mapping check
	// above would (correctly) reject it. Nothing rewrites a mounted config on upgrade,
	// so if this stops parsing, existing installs crash at startup on the new image.
	test('a legacy user config with a multi-line flow mapping still parses', () => {
		const fixture = path.join(__dirname, 'fixtures/legacy-flow-mapping-config.yml');
		expect(fs.existsSync(fixture), 'legacy config fixture is missing').toBe(true);

		const raw = fs.readFileSync(fixture, 'utf8');
		// Guard the fixture itself: if someone tidies the indentation away, the test
		// would keep passing while covering nothing.
		expect(
			raw.split('\n').some((line) => line.split('#')[0].trimEnd().endsWith('{')),
			'fixture no longer contains a multi-line flow mapping — it must, or it tests nothing'
		).toBe(true);

		const parsed = yaml.load(raw) as Record<string, any>;
		expect(parsed, 'legacy config parsed to nothing').toBeTruthy();
		expect(parsed.mailer?.templates?.welcomeTemplate?.subject).toBe('Welcome to OpsiMate!');
		// The fields loadConfig() needs, same as the shipped configs.
		expect(parsed.server?.port).toBeTruthy();
		expect(parsed.database?.path).toBeTruthy();
		expect(parsed.security?.private_keys_path).toBeTruthy();
	});
});
