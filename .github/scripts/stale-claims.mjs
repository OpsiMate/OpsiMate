// Releases issue claims that went quiet, so the next person can take the issue.
//
// An open issue with an assignee counts as stale when nothing happened on it for
// STALE_DAYS (default 14) and no open pull request references it (in this repo or
// any other, so a docs PR in OpsiMate/documentation holds the claim). A stale issue
// gets one comment and its assignees removed. Nothing else changes: labels, the
// issue body and the history stay.
//
// Holds:
//   - the `keep-assigned` label (long-running work a maintainer wants to keep parked)
//   - assignees listed in EXEMPT_ASSIGNEES (comma separated; default: idanlodzki)
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), STALE_DAYS, EXEMPT_ASSIGNEES,
// DRY_RUN=1 to only print what would happen (the workflow_dispatch default).
//
// Local dry run:
//   GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY=OpsiMate/OpsiMate DRY_RUN=1 \
//     node .github/scripts/stale-claims.mjs

import { createClient, report } from './github-api.mjs';

export const HOLD_LABEL = 'keep-assigned';
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseExemptAssignees(value) {
	return new Set(
		(value ?? 'idanlodzki')
			.split(',')
			.map((login) => login.trim().toLowerCase())
			.filter(Boolean)
	);
}

export function quietDays(issue, now) {
	return Math.floor((now - Date.parse(issue.updated_at)) / DAY_MS);
}

// Open pull requests that mention the issue, from any repository.
export function openLinkedPullRequests(timeline) {
	const urls = new Set();
	for (const event of timeline) {
		if (event.event !== 'cross-referenced') {
			continue;
		}
		const source = event.source?.issue;
		if (source?.pull_request && source.state === 'open') {
			urls.add(source.html_url);
		}
	}
	return [...urls];
}

// Why an issue is left alone, or null when it should be released. `linkedPullRequests`
// is only consulted once the cheaper checks pass, so callers can fetch it lazily.
export function holdReason(issue, { now, staleDays, exemptAssignees, linkedPullRequests }) {
	if (issue.labels.some((label) => label.name === HOLD_LABEL)) {
		return `has the ${HOLD_LABEL} label`;
	}
	const exempt = issue.assignees.find((assignee) => exemptAssignees.has(assignee.login.toLowerCase()));
	if (exempt) {
		return `assigned to maintainer ${exempt.login}`;
	}
	const quiet = quietDays(issue, now);
	if (quiet < staleDays) {
		return `active ${quiet} day(s) ago`;
	}
	if (linkedPullRequests.length > 0) {
		return `open PR: ${linkedPullRequests.join(', ')}`;
	}
	return null;
}

export function releaseComment(issue, staleDays) {
	const mentions = issue.assignees.map((assignee) => `@${assignee.login}`).join(' ');
	return [
		`Hi ${mentions}, this has been quiet for ${quietDays(issue, Date.now())} days with no PR, so I'm opening it back up for anyone who wants it. No hard feelings at all. If you still want to finish it, say so here and a maintainer will reassign it to you.`,
		'',
		`_Automated: a claim is released after ${staleDays} days without activity or an open PR. Maintainers can add the \`${HOLD_LABEL}\` label to hold one._`,
	].join('\n');
}

async function main() {
	const repository = process.env.GITHUB_REPOSITORY;
	if (!repository) {
		throw new Error('GITHUB_REPOSITORY is not set');
	}
	const staleDays = Number(process.env.STALE_DAYS ?? 14);
	if (!Number.isInteger(staleDays) || staleDays < 1) {
		throw new Error(`STALE_DAYS must be a positive integer, got "${process.env.STALE_DAYS}"`);
	}
	const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
	const exemptAssignees = parseExemptAssignees(process.env.EXEMPT_ASSIGNEES);
	const client = createClient(process.env.GITHUB_TOKEN);
	const now = Date.now();

	const assigned = (await client.paginate(`/repos/${repository}/issues?state=open&assignee=*`)).filter(
		(issue) => !issue.pull_request
	);

	const released = [];
	const held = [];
	for (const issue of assigned) {
		const cheapHold = holdReason(issue, {
			now,
			staleDays,
			exemptAssignees,
			linkedPullRequests: [],
		});
		let reason = cheapHold;
		if (!reason) {
			const timeline = await client.paginate(`/repos/${repository}/issues/${issue.number}/timeline`);
			reason = holdReason(issue, {
				now,
				staleDays,
				exemptAssignees,
				linkedPullRequests: openLinkedPullRequests(timeline),
			});
		}
		if (reason) {
			held.push(`- #${issue.number} (${issue.assignees.map((a) => a.login).join(', ')}): ${reason}`);
			continue;
		}

		released.push(`- #${issue.number} ${issue.title} (${issue.assignees.map((a) => a.login).join(', ')})`);
		if (dryRun) {
			continue;
		}
		await client.request(`/repos/${repository}/issues/${issue.number}/comments`, {
			method: 'POST',
			body: { body: releaseComment(issue, staleDays) },
		});
		await client.request(`/repos/${repository}/issues/${issue.number}/assignees`, {
			method: 'DELETE',
			body: { assignees: issue.assignees.map((assignee) => assignee.login) },
		});
	}

	await report(
		[
			`## Stale claims (${dryRun ? 'dry run' : 'applied'}, threshold ${staleDays} days)`,
			'',
			`${released.length} released, ${held.length} kept, ${assigned.length} assigned issues checked.`,
			'',
			released.length ? `### ${dryRun ? 'Would release' : 'Released'}` : '',
			...released,
			'',
			held.length ? '<details><summary>Kept</summary>\n' : '',
			...held,
			held.length ? '\n</details>' : '',
		].join('\n')
	);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
