import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAppVersion, useLatestRelease, useServerVersion } from '@/hooks/queries/version/useAppVersion';

// lib/version's pure helpers are tested; these three hooks are the decisions the sidebar
// badge actually renders: that the SERVER's build is what "I am running" reports, that a
// mismatch between client and server is surfaced rather than hidden, that "update
// available" only ever means older, and that a dev build or a playground session asks
// GitHub nothing at all.

// The client build's own version, which in tests would otherwise be 'dev'. Hoisted with the
// mocks that install it: vi.mock factories run while this file's imports are still being
// evaluated, so a plain top-level const is not initialized yet when they read it.
const { MOCKED_CLIENT_VERSION, playground } = vi.hoisted(() => ({
	MOCKED_CLIENT_VERSION: '1.2.0',
	playground: { enabled: false },
}));

vi.mock('@/lib/playground', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/playground')>()),
	isPlaygroundMode: () => playground.enabled,
}));

vi.mock('@/lib/version', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/version')>()),
	CLIENT_VERSION: MOCKED_CLIENT_VERSION,
}));

interface ResponseLike {
	ok: boolean;
	status: number;
	json: () => Promise<unknown>;
}

interface EndpointAnswers {
	server?: ResponseLike;
	release?: ResponseLike;
}

interface WrapperProps {
	children: ReactNode;
}

const okBody = (body: unknown): ResponseLike => ({ ok: true, status: 200, json: async () => body });
const statusError = (status = 503): ResponseLike => ({ ok: false, status, json: async () => ({ message: 'down' }) });

const serverAnswer = (version: string): ResponseLike =>
	okBody({ data: { version, commit: 'a1b2c3d', buildDate: '2026-10-01T00:00:00.000Z' } });

const releaseAnswer = (tag: string, htmlUrl?: string): ResponseLike =>
	okBody(htmlUrl === undefined ? { tag_name: tag } : { tag_name: tag, html_url: htmlUrl });

// One stub covering both endpoints, so a test states which answer each gives and any other
// URL is a failure rather than an unanswered request.
const stubEndpoints = (answers: EndpointAnswers) => {
	const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.startsWith('https://api.github.com/')) return (answers.release ?? statusError()) as unknown as Response;
		if (url.endsWith('/version')) return (answers.server ?? statusError()) as unknown as Response;
		throw new Error(`unexpected fetch to ${url}`);
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
};

const render = <T,>(hook: () => T) => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const wrapper = ({ children }: WrapperProps) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
	// The cache is returned alongside the hook so a test can wait on a query the hook
	// derives from rather than exposing its status.
	return { ...renderHook(hook, { wrapper }), queryClient };
};

beforeEach(() => {
	playground.enabled = false;
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('useAppVersion', () => {
	test('while the server has not answered, it reports the client build and nothing else', () => {
		// Both endpoints stay pending, which is the state the badge renders before boot.
		vi.stubGlobal(
			'fetch',
			vi.fn(() => new Promise<Response>(() => {}))
		);

		const { result } = render(() => useAppVersion());

		expect(result.current.version).toBe(MOCKED_CLIENT_VERSION);
		expect(result.current.commit).toBeNull();
		expect(result.current.buildDate).toBeNull();
		expect(result.current.mismatch).toBe(false);
		expect(result.current.updateAvailable).toBeNull();
	});

	test('the server’s version is what is reported, with its commit and build date', async () => {
		stubEndpoints({ server: serverAnswer('1.3.0') });

		const { result } = render(() => useAppVersion());
		await waitFor(() => expect(result.current.commit).toBe('a1b2c3d'));

		expect(result.current.version).toBe('1.3.0');
		expect(result.current.buildDate).toBe('2026-10-01T00:00:00.000Z');
		// The client's own build stays visible underneath, because the difference is the point.
		expect(result.current.clientVersion).toBe(MOCKED_CLIENT_VERSION);
		expect(result.current.mismatch).toBe(true);
	});

	test('mismatch is false when the server runs the same build as the client', async () => {
		stubEndpoints({ server: serverAnswer(MOCKED_CLIENT_VERSION) });

		const { result } = render(() => useAppVersion());
		await waitFor(() => expect(result.current.buildDate).toBe('2026-10-01T00:00:00.000Z'));

		expect(result.current.mismatch).toBe(false);
	});
});

// Split from the block above only to keep each describe readable; both are useAppVersion.
describe('useAppVersion’s update signal', () => {
	test('updateAvailable is the release only while the running version is older', async () => {
		stubEndpoints({
			server: serverAnswer(MOCKED_CLIENT_VERSION),
			release: releaseAnswer('v1.3.0', 'https://gh/releases/1'),
		});

		const { result } = render(() => useAppVersion());
		await waitFor(() => expect(result.current.updateAvailable).not.toBeNull());

		expect(result.current.updateAvailable).toEqual({ version: '1.3.0', url: 'https://gh/releases/1' });
	});

	test.each(['v1.2.0', 'v1.1.0'])(
		'updateAvailable is null when the newest release (%s) is not newer than what runs',
		async (tag) => {
			stubEndpoints({
				server: serverAnswer(MOCKED_CLIENT_VERSION),
				release: releaseAnswer(tag, 'https://gh/releases/x'),
			});

			const { result, queryClient } = render(() => useAppVersion());
			// Both halves checked on the same flush: the release really did land in the
			// cache, and the gate still refused to call it an update.
			await waitFor(() => {
				expect(queryClient.getQueryState(['appVersion', 'latestRelease'])?.status).toBe('success');
				expect(result.current.updateAvailable).toBeNull();
			});
		}
	);
});

describe('useLatestRelease', () => {
	test('a v-prefixed tag becomes the bare version paired with its release page', async () => {
		const fetchMock = stubEndpoints({ release: releaseAnswer('v1.4.0', 'https://gh/releases/4') });

		const { result } = render(() => useLatestRelease(MOCKED_CLIENT_VERSION));
		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual({ version: '1.4.0', url: 'https://gh/releases/4' });
		expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
			'https://api.github.com/repos/OpsiMate/OpsiMate/releases/latest',
		]);
	});

	test.each([
		['a GitHub error response', statusError()],
		['a tag that is not a.b.c', releaseAnswer('nightly', 'https://gh/releases/nightly')],
		['a release without html_url', releaseAnswer('v1.4.0')],
	])('%s resolves to no update rather than a failure', async (_label, answer) => {
		stubEndpoints({ release: answer });

		const { result } = render(() => useLatestRelease(MOCKED_CLIENT_VERSION));
		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toBeNull();
		expect(result.current.isError).toBe(false);
	});

	test('a dev build is never behind, so GitHub is not asked', async () => {
		const fetchMock = stubEndpoints({ release: releaseAnswer('v1.4.0', 'https://gh/releases/4') });

		const { result } = render(() => useLatestRelease('dev'));

		expect(result.current.isPending).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
		await Promise.resolve();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('a playground session does not ask GitHub either, even on a release build', () => {
		playground.enabled = true;
		const fetchMock = stubEndpoints({ release: releaseAnswer('v1.4.0', 'https://gh/releases/4') });

		render(() => useLatestRelease(MOCKED_CLIENT_VERSION));

		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('useServerVersion', () => {
	test('a non-ok /version is an error state, not a silent default', async () => {
		stubEndpoints({ server: statusError(500) });

		const { result } = render(() => useServerVersion());
		// The hook asks for retry: 1, which react-query spaces by a second — the error only
		// settles once that second attempt has also failed.
		await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
	});

	test('a playground session never fetches /version', () => {
		playground.enabled = true;
		const fetchMock = stubEndpoints({ server: serverAnswer('1.3.0') });

		render(() => useServerVersion());

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
