import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	HOLD_LABEL,
	RELEASE_MARKER,
	holdReason,
	needsReleaseComment,
	openLinkedPullRequests,
	parseExemptAssignees,
	quietDays,
	releaseComment,
} from './stale-claims.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-08T12:00:00Z');

function issue({ daysQuiet = 20, assignees = ['someone'], labels = [] } = {}) {
	return {
		number: 42,
		title: 'Do the thing',
		updated_at: new Date(NOW - daysQuiet * DAY_MS).toISOString(),
		assignees: assignees.map((login) => ({ login })),
		labels: labels.map((name) => ({ name })),
	};
}

const options = {
	now: NOW,
	staleDays: 14,
	exemptAssignees: parseExemptAssignees(undefined),
	linkedPullRequests: [],
};

describe('holdReason', () => {
	it('releases a claim quiet past the threshold with no open PR', () => {
		assert.equal(holdReason(issue(), options), null);
	});

	it('keeps a claim that is still active', () => {
		assert.match(holdReason(issue({ daysQuiet: 3 }), options), /active 3 day/);
	});

	it('treats the threshold day itself as stale', () => {
		assert.equal(holdReason(issue({ daysQuiet: 14 }), options), null);
	});

	it('keeps a claim while any open PR references the issue', () => {
		const reason = holdReason(issue(), {
			...options,
			linkedPullRequests: ['https://github.com/OpsiMate/documentation/pull/152'],
		});
		assert.match(reason, /documentation\/pull\/152/);
	});

	it(`keeps a claim with the ${HOLD_LABEL} label`, () => {
		assert.match(holdReason(issue({ labels: [HOLD_LABEL] }), options), new RegExp(HOLD_LABEL));
	});

	it('keeps a claim held by a maintainer, whatever the case of the login', () => {
		assert.match(holdReason(issue({ assignees: ['IdanLodzki'] }), options), /maintainer IdanLodzki/);
	});

	it('keeps the whole issue when one of several assignees is exempt', () => {
		const reason = holdReason(issue({ assignees: ['someone', 'idanlodzki'] }), options);
		assert.match(reason, /maintainer idanlodzki/);
	});
});

describe('openLinkedPullRequests', () => {
	const pr = (html_url, state, login) => ({
		event: 'cross-referenced',
		source: { issue: { pull_request: {}, state, html_url, user: { login } } },
	});

	it("collects the assignees' open PRs from cross-references, across repositories, without duplicates", () => {
		const timeline = [
			{ event: 'assigned' },
			pr('a', 'open', 'someone'),
			pr('a', 'open', 'someone'),
			pr('b', 'closed', 'someone'),
			{
				event: 'cross-referenced',
				source: { issue: { state: 'open', html_url: 'plain-issue', user: { login: 'someone' } } },
			},
			pr('c', 'open', 'SomeOne'),
		];
		assert.deepEqual(openLinkedPullRequests(timeline, [{ login: 'someone' }]), ['a', 'c']);
	});

	it("ignores other people's open PRs, so a maintainer's PR mentioning the issue does not hold the claim", () => {
		const timeline = [pr('theirs', 'open', 'maintainer'), pr('mine', 'open', 'someone')];
		assert.deepEqual(openLinkedPullRequests(timeline, [{ login: 'someone' }]), ['mine']);
		assert.deepEqual(openLinkedPullRequests(timeline, [{ login: 'nobody' }]), []);
	});
});

describe('parseExemptAssignees', () => {
	it('defaults to the maintainer and lower-cases a comma list', () => {
		assert.deepEqual([...parseExemptAssignees(undefined)], ['idanlodzki']);
		assert.deepEqual([...parseExemptAssignees(' Alice, bob ,')], ['alice', 'bob']);
	});
});

describe('releaseComment', () => {
	it('mentions every assignee, names the hold label and carries the marker', () => {
		const text = releaseComment(issue({ assignees: ['a', 'b'] }), 14);
		assert.match(text, /^Hi @a @b,/);
		assert.match(text, new RegExp(`\`${HOLD_LABEL}\``));
		assert.ok(text.includes(RELEASE_MARKER));
	});
});

describe('needsReleaseComment', () => {
	const bot = { type: 'Bot', login: 'github-actions[bot]' };
	const human = { type: 'User', login: 'someone' };
	const release = releaseComment(issue(), 14);

	it('posts on an issue with no comments or with a human comment last', () => {
		assert.equal(needsReleaseComment([]), true);
		assert.equal(needsReleaseComment([{ user: human, body: 'I will do it' }]), true);
		assert.equal(
			needsReleaseComment([
				{ user: bot, body: release },
				{ user: human, body: 'still here' },
			]),
			true
		);
	});

	it('does not post again when the newest comment is already the release comment', () => {
		assert.equal(
			needsReleaseComment([
				{ user: human, body: 'hi' },
				{ user: bot, body: release },
			]),
			false
		);
	});

	it('still posts after an unrelated bot comment', () => {
		assert.equal(needsReleaseComment([{ user: bot, body: 'Welcome! Join our Slack' }]), true);
	});
});

describe('quietDays', () => {
	it('rounds down to whole days', () => {
		assert.equal(quietDays(issue({ daysQuiet: 2.9 }), NOW), 2);
	});
});
