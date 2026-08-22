// Gate the client's `tsc` output against a committed baseline. `vite build` strips
// types, so type errors otherwise reach main unnoticed (this exact gap once shipped a
// hook calling a function with the wrong argument shape). The client carries a set of
// pre-existing type errors we don't fix in one sweep; this script FAILS only on errors
// NOT already in the baseline, so new code is gated while the backlog shrinks over time.
//
//   node scripts/check-types.mjs            check (used by CI); exits 1 on new errors
//   node scripts/check-types.mjs --update   rewrite the baseline from current output

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselineFile = join(clientDir, 'type-errors-baseline.txt');
// Some error messages embed absolute paths (e.g. a type printed as
// import("<repo>/packages/shared/dist/types")). That prefix differs by machine
// (/Users/... locally vs /home/runner/... on CI), so collapse it or the baseline
// would never match across environments.
const repoRoot = resolve(clientDir, '..', '..');

// tsc exits 1 (or 2) when it reports diagnostics — expected. Any OTHER failure means
// tsc never actually ran (binary missing, bad config path), which must fail the gate
// loudly instead of looking like "no errors".
const runTsc = () => {
	try {
		execSync('pnpm exec tsc -p tsconfig.app.json --noEmit', {
			cwd: clientDir,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		return '';
	} catch (error) {
		const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
		if (error.status !== 1 && error.status !== 2) {
			console.error(`Could not run tsc — the client typecheck gate did not execute:\n${output}`);
			process.exit(2);
		}
		return output;
	}
};

// Normalize each diagnostic to a machine- and line-stable identity:
//   "path(line,col): error TSxxxx: message" -> "path: error TSxxxx: message"
//   "error TSxxxx: message" (global, no position) -> kept as-is
// Global diagnostics (e.g. TS5058 "specified path does not exist") must be captured or
// a broken invocation would normalize to nothing and pass green.
const normalize = (output) => {
	const ids = new Set();
	for (const rawLine of output.split('\n')) {
		const line = rawLine.split(repoRoot).join('<repo>');
		const positioned = line.match(/^(.*?)\(\d+,\d+\): (error TS\d+: .*)$/);
		if (positioned) {
			ids.add(`${positioned[1]}: ${positioned[2]}`.trim());
			continue;
		}
		const global = line.match(/^(error TS\d+: .*)$/);
		if (global) ids.add(global[1].trim());
	}
	return [...ids].sort();
};

const current = normalize(runTsc());

if (process.argv.includes('--update')) {
	writeFileSync(baselineFile, current.length ? `${current.join('\n')}\n` : '');
	console.log(`Wrote ${current.length} baseline type-error(s) to ${baselineFile}`);
	process.exit(0);
}

const baseline = existsSync(baselineFile)
	? new Set(
			readFileSync(baselineFile, 'utf8')
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean)
		)
	: new Set();

const introduced = current.filter((id) => !baseline.has(id));
const currentSet = new Set(current);
const cleared = [...baseline].filter((id) => !currentSet.has(id));

if (cleared.length > 0) {
	console.log(
		`\n${cleared.length} baseline error(s) no longer occur — run ` +
			'`pnpm --filter @OpsiMate/client typecheck:update` to shrink the baseline.'
	);
}

if (introduced.length > 0) {
	console.error(`\n✖ ${introduced.length} NEW client type error(s) not in the baseline:\n`);
	for (const id of introduced) console.error(`  ${id}`);
	console.error(
		'\nFix them, or — if intentional — update the baseline with ' +
			'`pnpm --filter @OpsiMate/client typecheck:update`.'
	);
	process.exit(1);
}

console.log(`✓ No new client type errors (${baseline.size} known baseline error(s)).`);
