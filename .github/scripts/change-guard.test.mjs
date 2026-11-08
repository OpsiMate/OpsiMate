import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { REVIEWED_LABEL, countForcePushes, decide, flagFiles, renderReport } from './change-guard.mjs';

function file(filename, status = 'modified', previous_filename = undefined) {
	return { filename, status, previous_filename };
}

describe('flagFiles', () => {
	it('lets ordinary source and test files through', () => {
		const files = [
			file('apps/client/src/components/Alerts/AlertRow.tsx'),
			file('apps/server/src/bl/alerts/alert.bl.ts'),
			file('apps/server/tests/alerts.test.ts', 'added'),
			file('packages/shared/src/types.ts'),
			file('README.md'),
			file('docs/guide.md', 'added'),
		];
		assert.deepEqual(flagFiles(files), []);
	});

	it('flags workflows, hooks, scripts, manifests, lockfiles and tool configs', () => {
		const names = [
			'.github/workflows/ci.yaml',
			'.husky/pre-commit',
			'apps/client/scripts/check-types.mjs',
			'apps/server/package.json',
			'pnpm-lock.yaml',
			'apps/client/postcss.config.js',
			'apps/client/vite.config.ts',
			'.prettierrc',
			'apps/server/tsconfig.json',
			'Dockerfile.server',
			'infrastructure/helm/values.yaml',
			'apps/server/.env.example',
			'apps/client/index.html',
			'tools/setup.sh',
		];
		const flagged = flagFiles(names.map((name) => file(name)));
		assert.deepEqual(
			flagged.map((entry) => entry.filename),
			names,
			'every one of these needs a maintainer'
		);
	});

	it('flags a new file dropped at the repository root', () => {
		assert.equal(flagFiles([file('api.js', 'added')])[0].reason, 'new top-level file');
		assert.equal(flagFiles([file('setup.sh', 'added')])[0].reason, 'executable script');
		assert.deepEqual(flagFiles([file('CHANGELOG.md', 'modified')]), []);
	});

	it('flags paths with whitespace or non-ASCII characters', () => {
		const flagged = flagFiles([file('apps/client/src/lib/util​.ts', 'added')]);
		assert.equal(flagged[0].reason, 'path with whitespace or non-ASCII characters');
	});

	it('judges a rename by both names', () => {
		const flagged = flagFiles([file('apps/client/src/lib/x.ts', 'renamed', 'apps/client/vite.config.ts')]);
		assert.equal(flagged.length, 1);
		assert.equal(flagged[0].reason, 'build or tool config');
	});
});

describe('countForcePushes', () => {
	it('counts head_ref_force_pushed events only', () => {
		const timeline = [
			{ event: 'committed' },
			{ event: 'head_ref_force_pushed' },
			{ event: 'head_ref_force_pushed' },
		];
		assert.equal(countForcePushes(timeline), 2);
		assert.equal(countForcePushes([]), 0);
	});
});

describe('decide', () => {
	const flagged = [
		{
			filename: 'pnpm-lock.yaml',
			status: 'modified',
			reason: 'workspace or lockfile',
		},
	];

	it('passes dependabot and repository members without looking', () => {
		assert.equal(
			decide({
				login: 'dependabot[bot]',
				authorAssociation: 'CONTRIBUTOR',
				labels: [],
				flagged,
				forcePushes: 0,
			}).outcome,
			'pass'
		);
		for (const authorAssociation of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
			assert.equal(
				decide({
					login: 'x',
					authorAssociation,
					labels: [],
					flagged,
					forcePushes: 3,
				}).outcome,
				'pass'
			);
		}
	});

	it('passes a contributor PR with nothing flagged', () => {
		const verdict = decide({
			login: 'x',
			authorAssociation: 'CONTRIBUTOR',
			labels: [],
			flagged: [],
			forcePushes: 0,
		});
		assert.equal(verdict.outcome, 'pass');
	});

	it('fails a contributor PR with a sensitive file or a force-push', () => {
		assert.equal(
			decide({
				login: 'x',
				authorAssociation: 'FIRST_TIME_CONTRIBUTOR',
				labels: [],
				flagged,
				forcePushes: 0,
			}).outcome,
			'fail'
		);
		assert.equal(
			decide({
				login: 'x',
				authorAssociation: 'NONE',
				labels: [],
				flagged: [],
				forcePushes: 1,
			}).outcome,
			'fail'
		);
	});

	it(`passes once a maintainer adds the ${REVIEWED_LABEL} label`, () => {
		const verdict = decide({
			login: 'x',
			authorAssociation: 'CONTRIBUTOR',
			labels: [REVIEWED_LABEL],
			flagged,
			forcePushes: 1,
		});
		assert.equal(verdict.outcome, 'pass');
		assert.match(verdict.reason, new RegExp(REVIEWED_LABEL));
	});
});

describe('renderReport', () => {
	it('lists the force-push warning and each flagged file', () => {
		const text = renderReport({
			pr: { head: { ref: 'feat/x' } },
			flagged: [
				{
					filename: 'index.html',
					status: 'modified',
					reason: 'HTML entry point (script injection surface)',
				},
			],
			forcePushes: 1,
			verdict: { outcome: 'fail', reason: 'needs a look' },
		});
		assert.match(text, /guard: FAIL/);
		assert.match(text, /1 force-push\(es\) on `feat\/x`/);
		assert.match(text, /`index\.html` \(modified\): HTML entry point/);
	});
});
