import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	REVIEWED_LABEL,
	countForcePushes,
	decide,
	flagFiles,
	headPushedAt,
	latestReviewedLabelAt,
	renderReport,
	reviewIsCurrent,
} from './change-guard.mjs';

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
	const flagged = [{ filename: 'pnpm-lock.yaml', status: 'modified', reason: 'workspace or lockfile' }];
	const contributor = {
		login: 'x',
		authorAssociation: 'CONTRIBUTOR',
		labels: [],
		flagged,
		forcePushes: 0,
		reviewIsCurrent: false,
	};

	it('passes dependabot and repository members without looking', () => {
		assert.equal(decide({ ...contributor, login: 'dependabot[bot]' }).outcome, 'pass');
		for (const authorAssociation of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
			assert.equal(decide({ ...contributor, authorAssociation, forcePushes: 3 }).outcome, 'pass');
		}
	});

	it('passes a contributor PR with nothing flagged', () => {
		assert.equal(decide({ ...contributor, flagged: [] }).outcome, 'pass');
	});

	it('fails a contributor PR with a sensitive file or a force-push', () => {
		assert.equal(decide({ ...contributor, authorAssociation: 'FIRST_TIME_CONTRIBUTOR' }).outcome, 'fail');
		assert.equal(
			decide({ ...contributor, authorAssociation: 'NONE', flagged: [], forcePushes: 1 }).outcome,
			'fail'
		);
	});

	it(`passes once a maintainer adds the ${REVIEWED_LABEL} label after the latest push`, () => {
		const verdict = decide({ ...contributor, labels: [REVIEWED_LABEL], forcePushes: 1, reviewIsCurrent: true });
		assert.equal(verdict.outcome, 'pass');
		assert.match(verdict.reason, new RegExp(REVIEWED_LABEL));
	});

	it('fails again when a push lands after the label was added', () => {
		const verdict = decide({ ...contributor, labels: [REVIEWED_LABEL], reviewIsCurrent: false });
		assert.equal(verdict.outcome, 'fail');
		assert.match(verdict.reason, /predates the latest push/);
		assert.match(verdict.reason, /remove and re-add/);
	});
});

describe('reviewIsCurrent', () => {
	const t0 = Date.parse('2026-11-09T10:00:00Z');

	it('is true only when the label is newer than the head push', () => {
		assert.equal(reviewIsCurrent({ labeledAt: t0 + 1000, pushedAt: t0 }), true);
		assert.equal(reviewIsCurrent({ labeledAt: t0, pushedAt: t0 }), true);
		assert.equal(reviewIsCurrent({ labeledAt: t0 - 1000, pushedAt: t0 }), false);
	});

	it('is false when either side is unknown', () => {
		assert.equal(reviewIsCurrent({ labeledAt: null, pushedAt: t0 }), false);
		assert.equal(reviewIsCurrent({ labeledAt: t0, pushedAt: null }), false);
	});

	it('takes the newest reviewed label, and the newest pull_request run for the head as the push time', () => {
		const timeline = [
			{ event: 'labeled', label: { name: 'bug' }, created_at: '2026-11-09T12:00:00Z' },
			{ event: 'labeled', label: { name: REVIEWED_LABEL }, created_at: '2026-11-09T09:00:00Z' },
			{ event: 'labeled', label: { name: REVIEWED_LABEL }, created_at: '2026-11-09T11:00:00Z' },
		];
		assert.equal(latestReviewedLabelAt(timeline), Date.parse('2026-11-09T11:00:00Z'));
		assert.equal(
			latestReviewedLabelAt([{ event: 'labeled', label: { name: 'bug' }, created_at: '2026-11-09T12:00:00Z' }]),
			null
		);
		const runs = [
			{ event: 'pull_request', created_at: '2026-11-09T10:00:00Z' },
			{ event: 'pull_request', created_at: '2026-11-09T10:30:00Z' },
			// A labeled/unlabeled run of the guard itself is not a push.
			{ event: 'pull_request_target', created_at: '2026-11-09T13:00:00Z' },
		];
		assert.equal(headPushedAt(runs), Date.parse('2026-11-09T10:30:00Z'));
		assert.equal(headPushedAt([]), null);
		assert.equal(headPushedAt([{ event: 'pull_request_target', created_at: '2026-11-09T13:00:00Z' }]), null);
	});

	it('treats a force-push back to an already-run sha as a new push', () => {
		// Push A at 09:00, push B at 10:00, label at 11:00, force-push back to A at 12:00:
		// A's only run predates the label, the force-push does not.
		const runsForA = [{ event: 'pull_request', created_at: '2026-11-09T09:00:00Z' }];
		const timeline = [
			{ event: 'labeled', label: { name: REVIEWED_LABEL }, created_at: '2026-11-09T11:00:00Z' },
			{ event: 'head_ref_force_pushed', created_at: '2026-11-09T12:00:00Z' },
		];
		const pushedAt = headPushedAt(runsForA, timeline);
		assert.equal(pushedAt, Date.parse('2026-11-09T12:00:00Z'));
		assert.equal(reviewIsCurrent({ labeledAt: latestReviewedLabelAt(timeline), pushedAt }), false);
	});

	it('treats a fast-forward back to an already-run sha as a new push', () => {
		// Push A at 09:00, push B at 10:00, force-push back to A at 10:30, label at 11:00,
		// fast-forward to B at 12:00: B's first run and the force-push predate the label,
		// the pull_request run fired by the fast-forward does not.
		const runsForB = [
			{ event: 'pull_request', created_at: '2026-11-09T10:00:00Z' },
			{ event: 'pull_request', created_at: '2026-11-09T12:00:00Z' },
		];
		const timeline = [
			{ event: 'head_ref_force_pushed', created_at: '2026-11-09T10:30:00Z' },
			{ event: 'labeled', label: { name: REVIEWED_LABEL }, created_at: '2026-11-09T11:00:00Z' },
		];
		const pushedAt = headPushedAt(runsForB, timeline);
		assert.equal(pushedAt, Date.parse('2026-11-09T12:00:00Z'));
		assert.equal(reviewIsCurrent({ labeledAt: latestReviewedLabelAt(timeline), pushedAt }), false);
	});

	it('is current when the label follows every push and force-push', () => {
		const runs = [{ event: 'pull_request', created_at: '2026-11-09T10:00:00Z' }];
		const timeline = [
			{ event: 'head_ref_force_pushed', created_at: '2026-11-09T09:00:00Z' },
			{ event: 'labeled', label: { name: REVIEWED_LABEL }, created_at: '2026-11-09T11:00:00Z' },
		];
		const pushedAt = headPushedAt(runs, timeline);
		assert.equal(pushedAt, Date.parse('2026-11-09T10:00:00Z'));
		assert.equal(reviewIsCurrent({ labeledAt: latestReviewedLabelAt(timeline), pushedAt }), true);
	});
});

describe('decide without a push record', () => {
	it('fails with a message about the missing run instead of a stale label', () => {
		const verdict = decide({
			login: 'x',
			authorAssociation: 'CONTRIBUTOR',
			labels: [REVIEWED_LABEL],
			flagged: [{ filename: 'pnpm-lock.yaml', status: 'modified', reason: 'workspace or lockfile' }],
			forcePushes: 0,
			reviewIsCurrent: false,
			pushRecorded: false,
		});
		assert.equal(verdict.outcome, 'fail');
		assert.match(verdict.reason, /no pull_request workflow run/);
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
