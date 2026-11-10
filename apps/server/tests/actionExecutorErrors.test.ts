import { afterEach, describe, expect, test, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
	buildSampleContext,
	describeActionError,
	executeAction,
	ExecutableAction,
} from '../src/bl/actions/actionExecutor';

// A receiver that cannot be reached now reports why. fetch's own TypeError says only
// "fetch failed"; the socket layer's reason lives on `error.cause`, so every action type
// that goes through fetch is pinned here against a really closed port. The no-wait mode
// already reports the cause because it is built on node:http — that message is pinned by
// httpActionFireAndForget.test.ts, and must not change.

// Starts a server on an ephemeral port, stops it, and hands back the URL that is now
// refused. Same trick the fire-and-forget test uses.
const closedPortUrl = async (): Promise<string> => {
	const server = http.createServer(() => undefined);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	server.closeAllConnections();
	await new Promise<void>((resolve) => server.close(() => resolve()));
	return `http://127.0.0.1:${port}/hook`;
};

const httpAction = (url: string): ExecutableAction => ({
	name: 'Kick off the deploy',
	type: 'http',
	config: { method: 'POST', url, bodyTemplate: '{"alert":"{{name}}"}' },
});

const slackAction = (webhookUrl: string): ExecutableAction => ({
	name: 'Notify the team',
	type: 'slack',
	config: { webhookUrl, channel: '#ops' },
});

const loggedLines = (spy: { mock: { calls: unknown[][] } }): string =>
	spy.mock.calls.map((call) => String(call[0])).join('\n');

afterEach(() => {
	vi.restoreAllMocks();
});

describe('a failed action reports the underlying cause', () => {
	test('a waiting HTTP action against a closed port names the refused connection', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const result = await executeAction(httpAction(await closedPortUrl()), buildSampleContext());
		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/ECONNREFUSED/);
		// The message keeps fetch's own words in front of the cause, so a reader can tell
		// a transport failure from a receiver that answered.
		expect(result.message).toMatch(/^fetch failed/);
	});

	test('a Slack webhook on a closed port reports the cause as well', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const result = await executeAction(slackAction(await closedPortUrl()), buildSampleContext());
		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/ECONNREFUSED/);
	});

	test('a host that cannot resolve reports the lookup failure', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		// .invalid is reserved by RFC 2606 and never resolves; an offline machine fails the
		// lookup with EAI_AGAIN instead of ENOTFOUND.
		const result = await executeAction(
			httpAction('http://opsimate-does-not-exist.invalid/hook'),
			buildSampleContext()
		);
		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/ENOTFOUND|EAI_AGAIN/);
	});

	test('the server log line carries the cause, not only "fetch failed"', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const result = await executeAction(httpAction(await closedPortUrl()), buildSampleContext());
		const line = loggedLines(spy);
		expect(result.message).toMatch(/ECONNREFUSED/);
		expect(line).toContain("Failed to execute action 'Kick off the deploy'");
		expect(line).toMatch(/ECONNREFUSED/);
	});
});

describe('describeActionError', () => {
	test('keeps the timeout text unchanged', () => {
		const aborted = new Error('This operation was aborted');
		aborted.name = 'AbortError';
		expect(describeActionError(aborted)).toBe('Request timed out after 10s.');
	});

	test('keeps the error message when there is no cause', () => {
		expect(describeActionError(new Error('fetch failed'))).toBe('fetch failed');
	});

	test('ignores a cause that is not an Error', () => {
		expect(describeActionError(new Error('fetch failed', { cause: { code: 'ECONNREFUSED' } }))).toBe(
			'fetch failed'
		);
	});

	test('reads an AggregateError with no message of its own', () => {
		const refused = Object.assign(new Error(''), { code: 'ECONNREFUSED' });
		const refusedAgain = Object.assign(new Error(''), { code: 'ECONNREFUSED' });
		const aggregate = new AggregateError([refused, refusedAgain]);
		expect(describeActionError(new Error('fetch failed', { cause: aggregate }))).toBe('fetch failed: ECONNREFUSED');
	});

	test('reads a cause that carries only an errno code', () => {
		const cause = Object.assign(new Error(''), { code: 'ECONNRESET' });
		expect(describeActionError(new Error('fetch failed', { cause }))).toBe('fetch failed: ECONNRESET');
	});

	test('a thrown non-Error is still "Unknown error"', () => {
		expect(describeActionError('boom')).toBe('Unknown error');
	});
});
