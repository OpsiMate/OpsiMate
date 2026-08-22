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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselineFile = join(clientDir, 'type-errors-baseline.txt');

// tsc exits non-zero when it finds errors; its report is on stdout either way.
const runTsc = () => {
	try {
		execSync('pnpm exec tsc -p tsconfig.app.json --noEmit', {
			cwd: clientDir,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		return '';
	} catch (error) {
		return `${error.stdout ?? ''}${error.stderr ?? ''}`;
	}
};

// "path(line,col): error TSxxxx: message" -> "path: error TSxxxx: message". Dropping
// line/column keeps the baseline stable when unrelated edits shift line numbers.
const normalize = (output) => {
	const ids = new Set();
	for (const line of output.split('\n')) {
		const match = line.match(/^(.*?)\(\d+,\d+\): (error TS\d+: .*)$/);
		if (match) ids.add(`${match[1]}: ${match[2]}`.trim());
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
