import { Alert, AlertCallbackPayload, AlertCallbackWithSecret, AlertSeverity, AlertStatus } from '@OpsiMate/shared';
import { describe, expect, test, vi } from 'vitest';
import { AlertCallbackRepository } from '../src/dal/alertCallbackRepository';
import { CallbackDispatcher, renderBody, signCallback } from '../src/bl/callbacks/callbackDispatcher';

// The dispatcher is what keeps callbacks OFF the request path: emit only queues, the
// HTTP request runs later, per-callback lanes keep a slow receiver from delaying
// another, and a bulk operation collapses into one request per event.

interface RecordedDelivery {
	id: number;
	status: string;
	error: string | null;
}

interface FakeRepo {
	callbacks: AlertCallbackWithSecret[];
	deliveries: RecordedDelivery[];
	repo: AlertCallbackRepository;
}

// `callbacks` is read on every reload, so a test can edit it to stand in for an admin's save.
const makeRepo = (callbacks: AlertCallbackWithSecret[]): FakeRepo => {
	const deliveries: RecordedDelivery[] = [];
	const repo = {
		getEnabledAlertCallbacks: () => Promise.resolve(callbacks.filter((c) => c.enabled)),
		recordDelivery: (id: number, status: string, error: string | null) => {
			deliveries.push({ id, status, error });
			return Promise.resolve();
		},
	} as unknown as AlertCallbackRepository;
	return { callbacks, deliveries, repo };
};

// What fetch was called with, as strings.
const urlOf = (input: string | URL | Request): string =>
	typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
const bodyOf = (init?: RequestInit): string => (typeof init?.body === 'string' ? init.body : '');

let nextId = 1;
const makeCallback = (overrides: Partial<AlertCallbackWithSecret> = {}): AlertCallbackWithSecret => ({
	id: nextId++,
	name: 'Receiver',
	url: 'https://receiver.test/hook',
	method: 'POST',
	headers: null,
	bodyTemplate: null,
	events: ['silenced'],
	enabled: true,
	secret: 'top-secret',
	lastStatus: null,
	lastError: null,
	lastSentAt: null,
	createdAt: '2026-10-15T00:00:00.000Z',
	updatedAt: '2026-10-15T00:00:00.000Z',
	...overrides,
});

const makeAlert = (id: string): Alert => ({
	id,
	type: 'Custom',
	status: AlertStatus.FIRING,
	severity: AlertSeverity.CRITICAL,
	tags: { env: 'prod', severity: 'critical' },
	startsAt: '2026-10-15T09:00:00.000Z',
	updatedAt: '2026-10-15T09:05:00.000Z',
	alertUrl: `https://example.com/${id}`,
	alertName: `Alert ${id}`,
	createdAt: '2026-10-15T09:00:00.000Z',
	isSilenced: false,
});

const actor = { id: '7', name: 'Dana Levi' };

interface SentRequest {
	url: string;
	method: string;
	headers: Record<string, string>;
	body: string;
}

// A fetch stand-in that records requests and answers from a script of statuses (the
// last status repeats). A status of 0 means "never answer" (until the signal aborts).
const makeFetch = (statuses: number[] = [200]) => {
	const sent: SentRequest[] = [];
	const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		const status = statuses[Math.min(sent.length, statuses.length - 1)];
		sent.push({
			url: urlOf(input),
			method: init?.method ?? 'GET',
			headers: init?.headers as Record<string, string>,
			body: bodyOf(init),
		});
		if (status === 0) {
			return new Promise((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => {
					const error = new Error('aborted');
					error.name = 'AbortError';
					reject(error);
				});
			});
		}
		return new Response(status >= 400 ? 'nope' : 'ok', { status, statusText: status >= 400 ? 'Error' : 'OK' });
	});
	return { sent, fetchImpl: fetchImpl as unknown as typeof fetch };
};

const makeDispatcher = (
	repo: AlertCallbackRepository,
	fetchImpl: typeof fetch,
	options: { retryDelaysMs?: number[]; requestTimeoutMs?: number } = {}
) => {
	const sleeps: number[] = [];
	const dispatcher = new CallbackDispatcher(repo, {
		fetch: fetchImpl,
		retryDelaysMs: options.retryDelaysMs ?? [],
		requestTimeoutMs: options.requestTimeoutMs ?? 5_000,
		sleep: (ms) => {
			sleeps.push(ms);
			return Promise.resolve();
		},
		now: () => new Date('2026-10-15T10:00:00.000Z'),
	});
	return { dispatcher, sleeps };
};

const parsePayload = (request: SentRequest): AlertCallbackPayload => JSON.parse(request.body) as AlertCallbackPayload;

describe('CallbackDispatcher: delivery', () => {
	test('sends the JSON payload with the event, signature and custom headers; emit itself does not wait', async () => {
		const { repo } = makeRepo([
			makeCallback({ headers: { Authorization: 'Bearer abc', 'Content-Type': 'text/json' } }),
		]);
		const { sent, fetchImpl } = makeFetch();
		const { dispatcher } = makeDispatcher(repo, fetchImpl);
		await dispatcher.reload();

		dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor, details: { silencedUntil: null } });
		expect(sent).toHaveLength(0);

		await dispatcher.flush();
		expect(sent).toHaveLength(1);
		const [request] = sent;
		expect(request.url).toBe('https://receiver.test/hook');
		expect(request.method).toBe('POST');
		expect(request.headers['X-OpsiMate-Event']).toBe('silenced');
		expect(request.headers['X-OpsiMate-Delivery']).toMatch(/^[0-9a-f-]{36}$/);
		expect(request.headers['X-OpsiMate-Timestamp']).toBe(
			String(Math.floor(Date.parse('2026-10-15T10:00:00.000Z') / 1000))
		);
		expect(request.headers['X-OpsiMate-Signature']).toBe(
			signCallback('top-secret', Number(request.headers['X-OpsiMate-Timestamp']), request.body)
		);
		expect(request.headers.Authorization).toBe('Bearer abc');
		// A user header wins over the default.
		expect(request.headers['Content-Type']).toBe('text/json');

		expect(parsePayload(request)).toEqual({
			event: 'silenced',
			timestamp: '2026-10-15T10:00:00.000Z',
			actor,
			alerts: [makeAlert('a1')],
			details: { silencedUntil: null },
			bulk: false,
		});
	});

	test('only callbacks subscribed to the event receive it; nothing is queued when none is', async () => {
		const silenced = makeCallback({ events: ['silenced'], url: 'https://a.test' });
		const resolved = makeCallback({ events: ['resolved'], url: 'https://b.test' });
		const { repo } = makeRepo([silenced, resolved]);
		const { sent, fetchImpl } = makeFetch();
		const { dispatcher } = makeDispatcher(repo, fetchImpl);
		await dispatcher.reload();

		expect(dispatcher.wants('comment_added')).toBe(false);
		dispatcher.emit({ event: 'comment_added', alert: makeAlert('a1'), actor });
		dispatcher.emit({ event: 'resolved', alert: makeAlert('a1'), actor });
		await dispatcher.flush();

		expect(sent.map((r) => r.url)).toEqual(['https://b.test']);
	});

	test('a disabled callback is never loaded, and reload picks up edits', async () => {
		const callback = makeCallback({ enabled: false });
		const { repo } = makeRepo([callback]);
		const { sent, fetchImpl } = makeFetch();
		const { dispatcher } = makeDispatcher(repo, fetchImpl);
		await dispatcher.reload();

		dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor });
		await dispatcher.flush();
		expect(sent).toHaveLength(0);

		callback.enabled = true;
		await dispatcher.reload();
		dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor });
		await dispatcher.flush();
		expect(sent).toHaveLength(1);
	});

	test('a receiver that never answers times out and does not hold up another callback', async () => {
		const stuck = makeCallback({ url: 'https://stuck.test' });
		const fine = makeCallback({ url: 'https://fine.test' });
		const { repo, deliveries } = makeRepo([stuck, fine]);
		const sent: SentRequest[] = [];
		const fineAnswered: string[] = [];
		const fetchImpl: typeof fetch = async (input, init) => {
			sent.push({ url: urlOf(input), method: 'POST', headers: {}, body: bodyOf(init) });
			if (urlOf(input).startsWith('https://stuck')) {
				return new Promise((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => {
						const error = new Error('aborted');
						error.name = 'AbortError';
						reject(error);
					});
				});
			}
			fineAnswered.push(urlOf(input));
			return new Response('ok', { status: 200 });
		};
		const { dispatcher } = makeDispatcher(repo, fetchImpl, { requestTimeoutMs: 20 });
		await dispatcher.reload();

		dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor });
		await dispatcher.flush();

		expect(fineAnswered).toEqual(['https://fine.test']);
		expect(deliveries).toContainEqual({ id: stuck.id, status: 'error', error: 'Timed out after 20ms' });
		expect(deliveries).toContainEqual({ id: fine.id, status: 'success', error: null });
	});
});

describe('CallbackDispatcher: redirects', () => {
	test('a user header replaces a default whatever its casing', async () => {
		const { repo } = makeRepo([makeCallback({ headers: { 'content-type': 'text/plain', 'user-agent': 'mine' } })]);
		const { sent, fetchImpl } = makeFetch();
		const { dispatcher } = makeDispatcher(repo, fetchImpl);
		await dispatcher.reload();

		dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor, details: { silencedUntil: null } });
		await dispatcher.flush();

		const sentHeaders = new Headers(sent[0].headers);
		expect(sentHeaders.get('content-type')).toBe('text/plain');
		expect(sentHeaders.get('user-agent')).toBe('mine');
		expect(Object.keys(sent[0].headers).filter((k) => k.toLowerCase() === 'content-type')).toEqual([
			'content-type',
		]);
	});

	test('a redirect is not followed (the auth headers would travel with it) and counts as a failure', async () => {
		const callback = makeCallback({ headers: { Authorization: 'Bearer abc' } });
		const { repo, deliveries } = makeRepo([callback]);
		const { sent, fetchImpl } = makeFetch([302]);
		const { dispatcher } = makeDispatcher(repo, fetchImpl);
		await dispatcher.reload();

		dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor });
		await dispatcher.flush();

		expect(sent).toHaveLength(1);
		expect(sent[0].url).toBe('https://receiver.test/hook');
		expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({
			redirect: 'manual',
		});
		expect(deliveries).toEqual([
			{
				id: callback.id,
				status: 'error',
				error: 'HTTP 302: redirects are not followed, point the callback at the final URL',
			},
		]);
	});
});

describe('CallbackDispatcher: retries', () => {
	test('retries with the configured delays and records success once a retry lands', async () => {
		const callback = makeCallback();
		const { repo, deliveries } = makeRepo([callback]);
		const { sent, fetchImpl } = makeFetch([500, 503, 200]);
		const { dispatcher, sleeps } = makeDispatcher(repo, fetchImpl, { retryDelaysMs: [1_000, 5_000, 30_000] });
		await dispatcher.reload();

		dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor });
		await dispatcher.flush();

		expect(sent).toHaveLength(3);
		expect(sleeps).toEqual([1_000, 5_000]);
		expect(deliveries).toEqual([{ id: callback.id, status: 'success', error: null }]);
		// Every attempt carries the same delivery id, so a receiver that handled the first
		// try (and answered too late) can tell the retry is a repeat.
		expect(new Set(sent.map((r) => r.headers['X-OpsiMate-Delivery'])).size).toBe(1);
	});

	test('gives up after the last retry and records the error', async () => {
		const callback = makeCallback();
		const { repo, deliveries } = makeRepo([callback]);
		const { sent, fetchImpl } = makeFetch([502]);
		const { dispatcher, sleeps } = makeDispatcher(repo, fetchImpl, { retryDelaysMs: [10, 20] });
		await dispatcher.reload();

		dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor });
		await dispatcher.flush();

		expect(sent).toHaveLength(3);
		expect(sleeps).toEqual([10, 20]);
		expect(deliveries).toEqual([{ id: callback.id, status: 'error', error: 'HTTP 502 Error - nope' }]);
	});

	test('a callback delivers its events in order, one at a time', async () => {
		const { repo } = makeRepo([makeCallback({ events: ['silenced', 'unsilenced'] })]);
		const { sent, fetchImpl } = makeFetch([500, 200, 200]);
		const { dispatcher } = makeDispatcher(repo, fetchImpl, { retryDelaysMs: [1] });
		await dispatcher.reload();

		dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor });
		dispatcher.emit({ event: 'unsilenced', alert: makeAlert('a1'), actor });
		await dispatcher.flush();

		// silenced (failed), silenced (retry ok), unsilenced
		expect(sent.map((r) => r.headers['X-OpsiMate-Event'])).toEqual(['silenced', 'silenced', 'unsilenced']);
		const ids = sent.map((r) => r.headers['X-OpsiMate-Delivery']);
		expect(ids[0]).toBe(ids[1]);
		expect(ids[2]).not.toBe(ids[0]);
	});

	test('an edit made while a delivery waits applies to it: new URL, rotated secret', async () => {
		const callback = makeCallback({ events: ['silenced', 'unsilenced'] });
		const { repo, callbacks } = makeRepo([callback]);
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { sent, fetchImpl } = makeFetch();
		let calls = 0;
		// Only the first request is held: it is in flight while the admin saves.
		const gatedFetch: typeof fetch = async (input, init) => {
			if (calls++ === 0) await gate;
			return fetchImpl(input, init);
		};
		const { dispatcher } = makeDispatcher(repo, gatedFetch);
		await dispatcher.reload();

		dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor });
		dispatcher.emit({ event: 'unsilenced', alert: makeAlert('a1'), actor });
		callbacks[0] = { ...callback, url: 'https://moved.test/hook', secret: 'rotated-secret' };
		await dispatcher.reload();
		release();
		await dispatcher.flush();

		expect(sent.map((r) => r.url)).toEqual(['https://receiver.test/hook', 'https://moved.test/hook']);
		expect(sent[1].headers['X-OpsiMate-Signature']).toBe(
			signCallback('rotated-secret', Number(sent[1].headers['X-OpsiMate-Timestamp']), sent[1].body)
		);
	});
});

describe('CallbackDispatcher: resilience', () => {
	test('a crash inside one delivery does not break the lane for the next', async () => {
		const callback = makeCallback({ events: ['silenced', 'unsilenced'] });
		const { repo, deliveries } = makeRepo([callback]);
		let calls = 0;
		const fetchImpl: typeof fetch = () => {
			calls++;
			if (calls === 1) return Promise.reject(new Error('synchronous explosion'));
			return Promise.resolve(new Response('ok', { status: 200 }));
		};
		const { dispatcher } = makeDispatcher(repo, fetchImpl);
		await dispatcher.reload();

		dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor });
		dispatcher.emit({ event: 'unsilenced', alert: makeAlert('a1'), actor });
		await dispatcher.flush();

		expect(calls).toBe(2);
		expect(deliveries.map((d) => d.status)).toEqual(['error', 'success']);
	});

	test('a delivery queued before the callback was switched off is skipped', async () => {
		const callback = makeCallback();
		const { repo, deliveries } = makeRepo([callback]);
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { sent, fetchImpl } = makeFetch();
		const gatedFetch: typeof fetch = async (input, init) => {
			await gate;
			return fetchImpl(input, init);
		};
		const { dispatcher } = makeDispatcher(repo, gatedFetch);
		await dispatcher.reload();

		dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor });
		dispatcher.emit({ event: 'silenced', alert: makeAlert('a2'), actor });
		callback.enabled = false;
		await dispatcher.reload();
		release();
		await dispatcher.flush();

		// The first was already in flight; the second never went out.
		expect(sent).toHaveLength(1);
		expect(deliveries).toHaveLength(1);
	});

	test('a backlog beyond the cap sheds new deliveries instead of growing without bound', async () => {
		const { repo } = makeRepo([makeCallback()]);
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { sent, fetchImpl } = makeFetch();
		const gatedFetch: typeof fetch = async (input, init) => {
			await gate;
			return fetchImpl(input, init);
		};
		const { dispatcher } = makeDispatcher(repo, gatedFetch);
		await dispatcher.reload();

		for (let i = 0; i < 520; i++) dispatcher.emit({ event: 'silenced', alert: makeAlert(`a${i}`), actor });
		release();
		await dispatcher.flush();

		expect(sent).toHaveLength(500);
	});
});

describe('CallbackDispatcher: bulk batching', () => {
	test('everything emitted inside batched() becomes one request per event with every alert', async () => {
		const { repo } = makeRepo([makeCallback({ events: ['silenced', 'owner_assigned'] })]);
		const { sent, fetchImpl } = makeFetch();
		const { dispatcher } = makeDispatcher(repo, fetchImpl);
		await dispatcher.reload();

		const result = await dispatcher.batched(() => {
			for (const id of ['a1', 'a2', 'a3']) {
				dispatcher.emit({ event: 'silenced', alert: makeAlert(id), actor, details: { silencedUntil: null } });
				dispatcher.emit({ event: 'owner_assigned', alert: makeAlert(id), actor, details: { ownerId: '7' } });
			}
			expect(sent).toHaveLength(0);
			return Promise.resolve('done');
		});
		expect(result).toBe('done');
		await dispatcher.flush();

		expect(sent).toHaveLength(2);
		const silenced = parsePayload(sent[0]);
		expect(silenced.event).toBe('silenced');
		expect(silenced.bulk).toBe(true);
		expect(silenced.alerts.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
		expect(silenced.details).toEqual({ silencedUntil: null });
		const assigned = parsePayload(sent[1]);
		expect(assigned.event).toBe('owner_assigned');
		expect(assigned.alerts).toHaveLength(3);
	});

	test('two bulk operations running at once keep their alerts apart', async () => {
		const { repo } = makeRepo([makeCallback()]);
		const { sent, fetchImpl } = makeFetch();
		const { dispatcher } = makeDispatcher(repo, fetchImpl);
		await dispatcher.reload();

		const run = (ids: string[]) =>
			dispatcher.batched(async () => {
				for (const id of ids) {
					await new Promise((resolve) => setTimeout(resolve, 1));
					dispatcher.emit({ event: 'silenced', alert: makeAlert(id), actor });
				}
			});
		await Promise.all([run(['x1', 'x2']), run(['y1', 'y2', 'y3'])]);
		await dispatcher.flush();

		const groups = sent.map((r) => parsePayload(r).alerts.map((a) => a.id)).sort((a, b) => a.length - b.length);
		expect(groups).toEqual([
			['x1', 'x2'],
			['y1', 'y2', 'y3'],
		]);
	});

	test('a batch with nothing emitted sends nothing, and the error from the operation propagates', async () => {
		const { repo } = makeRepo([makeCallback()]);
		const { sent, fetchImpl } = makeFetch();
		const { dispatcher } = makeDispatcher(repo, fetchImpl);
		await dispatcher.reload();

		await dispatcher.batched(() => Promise.resolve());
		await expect(
			dispatcher.batched(() => {
				dispatcher.emit({ event: 'silenced', alert: makeAlert('a1'), actor });
				return Promise.reject(new Error('boom'));
			})
		).rejects.toThrow('boom');
		await dispatcher.flush();

		// The alert silenced before the failure was still changed, so its callback goes out.
		expect(sent).toHaveLength(1);
	});
});

describe('CallbackDispatcher: body template and test send', () => {
	const payload: AlertCallbackPayload = {
		event: 'resolved',
		timestamp: '2026-10-15T10:00:00.000Z',
		actor: { id: '7', name: 'Dana Levi' },
		alerts: [makeAlert('a1'), makeAlert('a2')],
		details: { comment: 'fixed' },
		bulk: true,
	};

	test('renders the callback variables, the first alert, and the whole payload', () => {
		const body = renderBody(
			'{"ev":"{{event}}","by":"{{actor.name}}","n":{{count}},"ids":"{{alertIds}}","first":"{{name}}","env":"{{label.env}}","raw":{{payload}}}',
			payload
		);
		const parsed = JSON.parse(body) as Record<string, unknown>;
		expect(parsed.ev).toBe('resolved');
		expect(parsed.by).toBe('Dana Levi');
		expect(parsed.n).toBe(2);
		expect(parsed.ids).toBe('a1,a2');
		expect(parsed.first).toBe('Alert a1');
		expect(parsed.env).toBe('prod');
		expect(parsed.raw).toEqual(payload);
	});

	test('a blank template falls back to the JSON payload', () => {
		expect(JSON.parse(renderBody('   ', payload))).toEqual(payload);
		expect(JSON.parse(renderBody(null, payload))).toEqual(payload);
	});

	test('test() sends one sample request with the given secret and reports the status', async () => {
		const { repo } = makeRepo([]);
		const { sent, fetchImpl } = makeFetch([404]);
		const { dispatcher } = makeDispatcher(repo, fetchImpl, { retryDelaysMs: [10] });

		const result = await dispatcher.test({
			url: 'https://receiver.test/t',
			method: 'PUT',
			headers: null,
			bodyTemplate: null,
			secret: 's3cret-value',
		});

		expect(result).toEqual({ ok: false, statusCode: 404, message: 'HTTP 404 Error - nope' });
		// No retries for a test: the admin is waiting on the result.
		expect(sent).toHaveLength(1);
		expect(sent[0].method).toBe('PUT');
		expect(sent[0].headers['X-OpsiMate-Signature']).toBe(
			signCallback('s3cret-value', Number(sent[0].headers['X-OpsiMate-Timestamp']), sent[0].body)
		);
		expect(parsePayload(sent[0]).event).toBe('silenced');
	});
});
