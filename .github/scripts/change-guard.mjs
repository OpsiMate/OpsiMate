// Fails a contributor pull request that touches files a maintainer must look at by
// hand, or whose history was rewritten, until a maintainer says they did.
//
// Why: a green CI run says the code compiles and the tests pass. It says nothing
// about a workflow edit, a postcss or vite config that now runs arbitrary code, a
// script added to index.html, or a force-push that replaced a reviewed branch with
// something else. Those are the checks a maintainer does by eye before merging;
// this makes them a status instead of a habit.
//
// Pass without looking: pull requests by owners, members and collaborators, and by
// dependabot. Pass after looking: a maintainer adds the `maintainer-reviewed`
// label, which re-runs the check. The label only counts if it was added after the
// current head was pushed, so a push on top of a reviewed branch (or a force-push
// replacing it) fails again until a maintainer re-checks and re-adds the label.
// "Pushed" comes from server-side records a contributor cannot backdate the way a
// commit's committer date can be: every push to a PR branch (fast-forward or force)
// fires the `pull_request` workflows for the new head, so the newest `pull_request`
// run for the head sha is the time that sha last became the head; the newest
// force-push timeline event is taken too. A head with no `pull_request` run (a
// conflicting PR, where those workflows do not fire) has no record, and the label
// never counts until it does.
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), PR_NUMBER.
//
// Local run against a real PR:
//   GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY=OpsiMate/OpsiMate PR_NUMBER=123 \
//     node .github/scripts/change-guard.mjs

import { createClient, report } from './github-api.mjs';

export const REVIEWED_LABEL = 'maintainer-reviewed';
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const TRUSTED_BOTS = new Set(['dependabot[bot]']);

// Path patterns a maintainer reads before merging, with the reason shown in the report.
const SENSITIVE_PATHS = [
	[/^\.github\//, 'workflow or repository automation'],
	[/^\.husky\//, 'git hook'],
	[/(^|\/)scripts\//, 'script directory'],
	[/(^|\/)package\.json$/, 'package manifest (scripts and dependencies)'],
	[/^(pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|\.npmrc)$/, 'workspace or lockfile'],
	[
		/(^|\/)(vite|vitest|postcss|tailwind|eslint|prettier|playwright|tsup|rollup|webpack|jest|babel)\.config\.[cm]?[jt]s$/,
		'build or tool config',
	],
	[/(^|\/)\.(prettierrc|eslintrc|babelrc|npmrc|nvmrc)(\.|$)/, 'tool config'],
	[/(^|\/)tsconfig[^/]*\.json$/, 'TypeScript config'],
	[/(^|\/)(Dockerfile|docker-compose)/, 'container build'],
	[/^infrastructure\//, 'infrastructure'],
	[/(^|\/)\.env/, 'environment file'],
	[/(^|\/)index\.html$/, 'HTML entry point (script injection surface)'],
	[/\.(sh|bash|zsh|ps1|cjs|mjs)$/, 'executable script'],
];

function pathReason(path) {
	for (const [pattern, reason] of SENSITIVE_PATHS) {
		if (pattern.test(path)) {
			return reason;
		}
	}
	return null;
}

// Files from GET /pulls/{n}/files -> [{ filename, status, reason }] for the ones a
// maintainer must read. A rename is judged by both names.
export function flagFiles(files) {
	const flagged = [];
	for (const file of files) {
		const paths = [file.filename, file.previous_filename].filter(Boolean);
		let reason = paths.map(pathReason).find(Boolean) ?? null;
		if (!reason && file.status === 'added' && !file.filename.includes('/')) {
			reason = 'new top-level file';
		}
		if (!reason && /[^\x21-\x7e]/.test(file.filename)) {
			reason = 'path with whitespace or non-ASCII characters';
		}
		if (reason) {
			flagged.push({ filename: file.filename, status: file.status, reason });
		}
	}
	return flagged;
}

export function countForcePushes(timeline) {
	return timeline.filter((event) => event.event === 'head_ref_force_pushed').length;
}

// When the reviewed label was last added, as a timestamp, or null if never.
export function latestReviewedLabelAt(timeline) {
	let latest = null;
	for (const event of timeline) {
		if (event.event !== 'labeled' || event.label?.name !== REVIEWED_LABEL) {
			continue;
		}
		const at = Date.parse(event.created_at);
		if (latest === null || at > latest) {
			latest = at;
		}
	}
	return latest;
}

// When the current head last reached GitHub, or null when there is no record.
export function headPushedAt(runs, timeline = []) {
	let latest = null;
	for (const run of runs) {
		if (run.event !== 'pull_request') {
			continue;
		}
		const at = Date.parse(run.created_at);
		if (latest === null || at > latest) {
			latest = at;
		}
	}
	if (latest === null) {
		return null;
	}
	for (const event of timeline) {
		if (event.event !== 'head_ref_force_pushed') {
			continue;
		}
		const at = Date.parse(event.created_at);
		if (at > latest) {
			latest = at;
		}
	}
	return latest;
}

export function reviewIsCurrent({ labeledAt, pushedAt }) {
	return labeledAt !== null && pushedAt !== null && labeledAt >= pushedAt;
}

// The verdict for a pull request given what was found. `outcome` is 'pass' or
// 'fail'; `reason` is what the report says.
export function decide({
	login,
	authorAssociation,
	labels,
	flagged,
	forcePushes,
	reviewIsCurrent,
	pushRecorded = true,
}) {
	if (TRUSTED_BOTS.has(login)) {
		return {
			outcome: 'pass',
			reason: `${login} pull requests are not guarded`,
		};
	}
	if (TRUSTED_ASSOCIATIONS.has(authorAssociation)) {
		return {
			outcome: 'pass',
			reason: `author is a repository ${authorAssociation.toLowerCase()}`,
		};
	}
	const findings = flagged.length + (forcePushes > 0 ? 1 : 0);
	if (findings === 0) {
		return { outcome: 'pass', reason: 'no sensitive files and no force-push' };
	}
	const summary = `${flagged.length} sensitive file(s), ${forcePushes} force-push(es)`;
	if (labels.includes(REVIEWED_LABEL)) {
		if (reviewIsCurrent) {
			return {
				outcome: 'pass',
				reason: `a maintainer added the ${REVIEWED_LABEL} label after the latest push`,
			};
		}
		return {
			outcome: 'fail',
			reason: pushRecorded
				? `the ${REVIEWED_LABEL} label predates the latest push (${summary}). Re-check the new commits, then remove and re-add the label.`
				: `the head sha has no pull_request workflow run to date the push (${summary}); is the PR conflicting? Once it runs, remove and re-add the ${REVIEWED_LABEL} label.`,
		};
	}
	return {
		outcome: 'fail',
		reason: `needs a maintainer's eyes: ${summary}. Check them, then add the ${REVIEWED_LABEL} label to let the PR through.`,
	};
}

export function renderReport({ pr, flagged, forcePushes, verdict }) {
	const lines = [`## Sensitive change guard: ${verdict.outcome.toUpperCase()}`, '', verdict.reason, ''];
	if (forcePushes > 0) {
		lines.push(
			`- ${forcePushes} force-push(es) on \`${pr.head.ref}\`: re-read the whole diff, not just the last commit.`
		);
	}
	for (const file of flagged) {
		lines.push(`- \`${file.filename}\` (${file.status}): ${file.reason}`);
	}
	return lines.join('\n');
}

async function main() {
	const repository = process.env.GITHUB_REPOSITORY;
	const number = Number(process.env.PR_NUMBER);
	if (!repository || !Number.isInteger(number)) {
		throw new Error('GITHUB_REPOSITORY and PR_NUMBER must be set');
	}
	const client = createClient(process.env.GITHUB_TOKEN);

	const pr = await client.request(`/repos/${repository}/pulls/${number}`);
	const files = await client.paginate(`/repos/${repository}/pulls/${number}/files`);
	const timeline = await client.paginate(`/repos/${repository}/issues/${number}/timeline`);
	const runs = (await client.request(`/repos/${repository}/actions/runs?head_sha=${pr.head.sha}&per_page=100`))
		.workflow_runs;

	const flagged = flagFiles(files);
	const forcePushes = countForcePushes(timeline);
	const pushedAt = headPushedAt(runs, timeline);
	const verdict = decide({
		login: pr.user.login,
		authorAssociation: pr.author_association,
		labels: pr.labels.map((label) => label.name),
		flagged,
		forcePushes,
		reviewIsCurrent: reviewIsCurrent({ labeledAt: latestReviewedLabelAt(timeline), pushedAt }),
		pushRecorded: pushedAt !== null,
	});

	await report(renderReport({ pr, flagged, forcePushes, verdict }));
	if (verdict.outcome === 'fail') {
		console.log(`::error::${verdict.reason}`);
		process.exit(1);
	}
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
