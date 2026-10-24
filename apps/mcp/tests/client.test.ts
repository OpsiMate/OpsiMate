import { describe, expect, test } from 'vitest';
import { OpsiMateApiError, OpsiMateClient } from '../src/opsimate/client';

// The REST client's wire format: what URL and headers OpsiMate receives for each read
// (search is trimmed, empty values are left out),
// and how its answers (and failures) come back.

interface Recorded {
	url: URL;
	headers: Record<string, string>;
}

const stubFetch = (respond: (url: URL) => Response | Promise<Response>) => {
	const calls: Recorded[] = [];
	const fetchImpl: typeof fetch = async (input, init) => {
		const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
		calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
		return respond(url);
	};
	return { calls, fetchImpl };
};

const ok = (data: unknown): Response => new Response(JSON.stringify({ success: true, data }), { status: 200 });

const client = (fetchImpl: typeof fetch, timeoutMs?: number) =>
	new OpsiMateClient(
		'http://opsimate.test:3001/',
		{ header: ['x-api-token', 'tok'] },
		{ fetch: fetchImpl, timeoutMs }
	);

describe('OpsiMateClient', () => {
	test('encodes a list query the way the UI does, and maps the page', async () => {
		const { calls, fetchImpl } = stubFetch(() => ok({ alerts: [{ id: 'a' }], total: 7, nextCursor: 'c2' }));
		const page = await client(fetchImpl).queryAlerts({
			filters: { severity: ['Critical'], '!status': ['Silenced'] },
			from: '2026-10-20T08:00:00Z',
			to: null,
			search: '  disk ',
			sort: 'alertName',
			dir: 'asc',
			limit: 50,
			cursor: 'c1',
		});
		expect(page).toEqual({ items: [{ id: 'a' }], total: 7, nextCursor: 'c2' });
		const [call] = calls;
		expect(call.url.origin + call.url.pathname).toBe('http://opsimate.test:3001/api/v1/alerts');
		expect(Object.fromEntries(call.url.searchParams)).toEqual({
			filters: JSON.stringify({ severity: ['Critical'], '!status': ['Silenced'] }),
			from: '2026-10-20T08:00:00Z',
			search: 'disk',
			sort: 'alertName',
			dir: 'asc',
			limit: '50',
			cursor: 'c1',
		});
		expect(call.headers['x-api-token']).toBe('tok');
	});

	test('keeps a path prefix in the OpsiMate URL (a reverse proxy at /opsimate)', async () => {
		const { calls, fetchImpl } = stubFetch(() => ok({ alerts: [], total: 0 }));
		await new OpsiMateClient(
			'https://host.test/opsimate',
			{ header: ['x-api-token', 'tok'] },
			{ fetch: fetchImpl }
		).queryAlerts({ filters: {} });
		expect(calls[0].url.origin + calls[0].url.pathname).toBe('https://host.test/opsimate/api/v1/alerts');
	});

	test('a query without a limit asks for the largest page, so "everything" is not the server default', async () => {
		const { calls, fetchImpl } = stubFetch(() => ok({ alerts: [] }));
		const page = await client(fetchImpl).queryResolvedAlerts({ filters: {} });
		expect(page).toEqual({ items: [], total: 0, nextCursor: null });
		expect(calls[0].url.pathname).toBe('/api/v1/alerts/resolved');
		expect(calls[0].url.searchParams.get('limit')).toBe('1000');
		expect(calls[0].url.searchParams.has('filters')).toBe(false);
	});

	test('analytics sends tz and the filter record; unwraps nested envelopes', async () => {
		const { calls, fetchImpl } = stubFetch((url) => {
			if (url.pathname.endsWith('/comments')) return ok({ comments: [{ id: 'c' }] });
			if (url.pathname.endsWith('/root-cause')) return ok({ rootCause: null });
			return ok({ range: {} });
		});
		const c = client(fetchImpl);
		await c.getAnalytics({
			from: '2026-10-13T00:00:00Z',
			to: null,
			timeZone: 'UTC',
			filters: { severity: ['Info'] },
			tagKey: 'env',
		});
		expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({
			from: '2026-10-13T00:00:00Z',
			tz: 'UTC',
			filters: '{"severity":["Info"]}',
			tagKey: 'env',
		});
		expect(await c.getComments('a/b')).toEqual([{ id: 'c' }]);
		expect(calls[1].url.pathname).toBe('/api/v1/alerts/a%2Fb/comments');
		expect(await c.getRootCause('a')).toBeNull();
	});

	test('404 is null for a lookup; 401 and 403 say the credentials were refused; other errors carry the status', async () => {
		const { fetchImpl } = stubFetch((url) => {
			if (url.pathname.endsWith('/alerts/missing')) {
				return new Response(JSON.stringify({ success: false, error: 'Alert not found' }), { status: 404 });
			}
			if (url.pathname.endsWith('/owners')) {
				return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), { status: 401 });
			}
			return new Response('gateway exploded', { status: 502 });
		});
		const c = client(fetchImpl);
		expect(await c.getAlert('missing')).toBeNull();
		await expect(c.getOwners()).rejects.toMatchObject({
			status: 401,
			message: expect.stringContaining('refused the credentials'),
		});
		const error = await c.listDashboards().catch((e: unknown) => e);
		expect(error).toBeInstanceOf(OpsiMateApiError);
		expect((error as OpsiMateApiError).status).toBe(502);
		expect((error as OpsiMateApiError).message).toContain('gateway exploded');
	});

	test('an unreachable OpsiMate and a timeout are reported as such, without a stack of fetch internals', async () => {
		const down: typeof fetch = () => Promise.reject(new TypeError('fetch failed'));
		await expect(client(down).getOwners()).rejects.toMatchObject({
			status: 0,
			message: expect.stringContaining('could not be reached (fetch failed)'),
		});
		const hanging: typeof fetch = (_input, init) =>
			new Promise((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => {
					const error = new Error('aborted');
					error.name = 'AbortError';
					reject(error);
				});
			});
		await expect(client(hanging, 20).getOwners()).rejects.toMatchObject({
			message: expect.stringContaining('timed out'),
		});
		// Headers arrive, the body never does: the same deadline applies.
		const stalledBody: typeof fetch = (_input, init) =>
			Promise.resolve(
				new Response(
					new ReadableStream({
						start(controller) {
							init?.signal?.addEventListener('abort', () => {
								const error = new Error('aborted');
								error.name = 'AbortError';
								controller.error(error);
							});
						},
					}),
					{ status: 200 }
				)
			);
		await expect(client(stalledBody, 20).getOwners()).rejects.toMatchObject({
			status: 0,
			message: expect.stringContaining('timed out'),
		});
	});
});
