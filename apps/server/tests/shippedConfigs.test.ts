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
	{
		file: 'apps/server/local-config.yml',
		requiredPaths: [
			['server', 'port'],
			['database', 'path'],
			['security', 'private_keys_path'],
		],
	},
];

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
				expect(readAtPath(parsed, keys), `${file} is missing ${keys.join('.')}`).toBeDefined();
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
});
