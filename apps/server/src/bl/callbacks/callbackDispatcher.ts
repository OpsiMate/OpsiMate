import { AsyncLocalStorage } from 'node:async_hooks';
import { createHmac, randomUUID } from 'node:crypto';
import {
	Alert,
	AlertCallback,
	AlertCallbackActor,
	AlertCallbackDetails,
	AlertCallbackEvent,
	AlertCallbackPayload,
	AlertCallbackTestResult,
	AlertCallbackWithSecret,
	Logger,
} from '@OpsiMate/shared';
import { AlertCallbackRepository } from '../../dal/alertCallbackRepository';
import { callbacksSentTotal } from '../../metrics';
import { buildAlertContext, resolvePlaceholders } from '../actions/actionExecutor';

const logger = new Logger('bl/callbacks/callbackDispatcher');

// A change to an alert that callbacks may want to hear about. Emitted by the alert BL
// right after the change (and its history entry) is committed.
export interface CallbackEventInput {
	event: AlertCallbackEvent;
	alert: Alert;
	actor: AlertCallbackActor;
	details?: AlertCallbackDetails;
}

// The request-independent parts of a callback: what the test endpoint sends and what a
// stored callback resolves to.
export interface CallbackTarget extends Pick<AlertCallback, 'url' | 'method' | 'headers' | 'bodyTemplate'> {
	secret?: string | null;
}

export interface CallbackDispatcherOptions {
	fetch?: typeof fetch;
	requestTimeoutMs?: number;
	// Waits between attempts: n entries = n retries after the first try.
	retryDelaysMs?: number[];
	sleep?: (ms: number) => Promise<void>;
	now?: () => Date;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRY_DELAYS_MS = [1_000, 5_000, 30_000];
const MAX_ERROR_LENGTH = 500;
// Deliveries waiting per callback while its receiver is slow or down. Beyond this the
// newest are dropped (logged + counted) rather than holding every payload in memory.
const MAX_PENDING_PER_CALLBACK = 500;

interface Delivery {
	callback: AlertCallbackWithSecret;
	payload: AlertCallbackPayload;
	// One id for every attempt of this delivery (X-OpsiMate-Delivery), so a receiver that
	// handled the first try but answered too late can recognise the retry as a repeat.
	deliveryId: string;
}

// A place in one callback's lane. Its payloads are known at once for a single change;
// for a bulk change they are filled in when the operation finishes, but the place is
// taken at the bulk's first emit, so a change emitted meanwhile by another request still
// reaches the receiver after it. An empty list sends nothing.
interface QueuedDelivery {
	payloads: AlertCallbackPayload[] | Promise<AlertCallbackPayload[]>;
}

// A bulk operation in progress, per event: the alerts collected so far and how to fill
// the place the event holds in each subscribed callback's lane.
interface BatchSlot {
	inputs: CallbackEventInput[];
	fill: (payloads: AlertCallbackPayload[]) => void;
}

type Batch = Map<AlertCallbackEvent, BatchSlot>;

interface SendResult {
	ok: boolean;
	statusCode?: number;
	message: string;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Sends callbacks for alert changes WITHOUT ever being on the request's path.
//
// - `emit` is synchronous and cheap: it only looks up the in-memory list of enabled
//   callbacks (reloaded on every edit) and queues a delivery. The HTTP request runs
//   later, on its own; the API response never waits for a receiver.
// - Deliveries are serialized PER CALLBACK (a lane each), so one slow or retrying
//   receiver never delays another, and a receiver sees a callback's events in order.
// - `batched` collapses everything emitted while a bulk operation runs into one
//   request per event, with every affected alert in `alerts`.
export class CallbackDispatcher {
	private subscriptions: AlertCallbackWithSecret[] = [];
	private readonly lanes = new Map<number, Promise<void>>();
	private readonly pending = new Map<number, number>();
	private readonly batchScope = new AsyncLocalStorage<Batch>();
	private readonly fetchImpl: typeof fetch;
	private readonly requestTimeoutMs: number;
	private readonly retryDelaysMs: number[];
	private readonly sleep: (ms: number) => Promise<void>;
	private readonly now: () => Date;

	constructor(
		private readonly repo: AlertCallbackRepository,
		options: CallbackDispatcherOptions = {}
	) {
		this.fetchImpl = options.fetch ?? fetch;
		this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
		this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
		this.sleep = options.sleep ?? defaultSleep;
		this.now = options.now ?? (() => new Date());
	}

	// Re-reads the enabled callbacks. Called at startup and after every create / update /
	// delete, so the hot path never touches the database.
	async reload(): Promise<void> {
		this.subscriptions = await this.repo.getEnabledAlertCallbacks();
	}

	// Whether any enabled callback listens to this event — lets a caller skip the work of
	// loading the alert snapshot when nobody would receive it.
	wants(event: AlertCallbackEvent): boolean {
		return this.subscriptions.some((callback) => callback.events.includes(event));
	}

	emit(input: CallbackEventInput): void {
		if (!this.wants(input.event)) return;
		const batch = this.batchScope.getStore();
		if (batch) {
			this.collect(batch, input);
			return;
		}
		const payload: AlertCallbackPayload = {
			event: input.event,
			timestamp: this.now().toISOString(),
			actor: input.actor,
			alerts: [input.alert],
			details: input.details ?? {},
			bulk: false,
		};
		this.enqueue(input.event, { payloads: [payload] });
	}

	// Runs `fn` (a bulk operation) collecting its emits; when it finishes, each event
	// seen becomes ONE payload carrying every alert it touched, delivered where the
	// event's first emit stood in line. Per-alert details are the same across a bulk
	// operation, so the first alert's are used.
	async batched<T>(fn: () => Promise<T>): Promise<T> {
		const batch: Batch = new Map();
		try {
			return await this.batchScope.run(batch, fn);
		} finally {
			// Also when fn throws: the alerts changed before the failure were changed, and
			// the lanes holding a place for this bulk must not wait forever.
			this.flushBatch(batch);
		}
	}

	// The first emit of an event takes its place in the lanes; later ones join it.
	private collect(batch: Batch, input: CallbackEventInput): void {
		const slot = batch.get(input.event);
		if (slot) {
			slot.inputs.push(input);
			return;
		}
		let fill: (payloads: AlertCallbackPayload[]) => void = () => {};
		const payloads = new Promise<AlertCallbackPayload[]>((resolve) => {
			fill = resolve;
		});
		batch.set(input.event, { inputs: [input], fill });
		this.enqueue(input.event, { payloads });
	}

	private flushBatch(batch: Batch): void {
		const timestamp = this.now().toISOString();
		for (const [event, { inputs, fill }] of batch) {
			fill(
				inputs.length === 0
					? []
					: [
							{
								event,
								timestamp,
								actor: inputs[0].actor,
								alerts: inputs.map((input) => input.alert),
								details: inputs[0].details ?? {},
								bulk: true,
							},
						]
			);
		}
	}

	private enqueue(event: AlertCallbackEvent, queued: QueuedDelivery): void {
		for (const callback of this.subscriptions) {
			if (!callback.events.includes(event)) continue;
			const waiting = this.pending.get(callback.id) ?? 0;
			if (waiting >= MAX_PENDING_PER_CALLBACK) {
				logger.warn(`Callback "${callback.name}" has ${waiting} deliveries waiting; dropping ${event}`);
				callbacksSentTotal.inc({ event, outcome: 'dropped' });
				continue;
			}
			this.pending.set(callback.id, waiting + 1);
			const lane = this.lanes.get(callback.id) ?? Promise.resolve();
			// The lane must survive anything deliver throws, or every later delivery for
			// this callback would chain onto a rejected promise and never run.
			const next = lane
				.then(() => this.runQueued(callback, queued))
				.catch((error: unknown) => logger.error(`Callback "${callback.name}" delivery crashed`, error))
				.finally(() => this.pending.set(callback.id, (this.pending.get(callback.id) ?? 1) - 1));
			this.lanes.set(callback.id, next);
		}
	}

	private async runQueued(callback: AlertCallbackWithSecret, queued: QueuedDelivery): Promise<void> {
		// A ready payload starts at once (no extra tick): only a bulk's place waits.
		const payloads = Array.isArray(queued.payloads) ? queued.payloads : await queued.payloads;
		for (const payload of payloads) {
			await this.deliver({ callback, payload, deliveryId: randomUUID() });
		}
	}

	// Resolves once every queued delivery has finished (tests and shutdown).
	async flush(): Promise<void> {
		await Promise.all([...this.lanes.values()]);
	}

	// The callback as it is NOW, if it still wants the event. A delivery waits in its lane
	// with the subscription it was queued under; by the time its turn comes an admin may
	// have moved the URL or rotated the secret (the edit applies), or switched the
	// callback off, deleted it or dropped the event (the delivery is skipped).
	private currentSubscription(callbackId: number, event: AlertCallbackEvent): AlertCallbackWithSecret | undefined {
		return this.subscriptions.find((current) => current.id === callbackId && current.events.includes(event));
	}

	private async deliver({ callback, payload, deliveryId }: Delivery): Promise<void> {
		let result: SendResult = { ok: false, message: 'Not sent' };
		for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt++) {
			if (attempt > 0) await this.sleep(this.retryDelaysMs[attempt - 1]);
			const target = this.currentSubscription(callback.id, payload.event);
			if (!target) return;
			result = await this.sendOnce(target, payload, deliveryId);
			if (result.ok) break;
			logger.warn(
				`Callback "${target.name}" (${payload.event}) attempt ${attempt + 1} failed: ${result.message}`
			);
		}
		callbacksSentTotal.inc({ event: payload.event, outcome: result.ok ? 'success' : 'error' });
		try {
			await this.repo.recordDelivery(
				callback.id,
				result.ok ? 'success' : 'error',
				result.ok ? null : result.message.slice(0, MAX_ERROR_LENGTH)
			);
		} catch (error) {
			logger.error(`Failed to record delivery status for callback ${callback.id}`, error);
		}
	}

	// One sample request with the given target, for the Settings "Send test" button.
	async test(target: CallbackTarget): Promise<AlertCallbackTestResult> {
		return this.sendOnce(target, buildSamplePayload(this.now()));
	}

	private async sendOnce(
		target: CallbackTarget,
		payload: AlertCallbackPayload,
		deliveryId: string = randomUUID()
	): Promise<SendResult> {
		const body = renderBody(target.bodyTemplate, payload);
		// The timestamp and signature are per attempt (a replay check must see a fresh
		// time); the delivery id is not (see Delivery).
		const sentAt = Math.floor(this.now().getTime() / 1000);
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'User-Agent': 'OpsiMate-Callback/1',
			'X-OpsiMate-Event': payload.event,
			'X-OpsiMate-Delivery': deliveryId,
			'X-OpsiMate-Timestamp': String(sentAt),
		};
		if (target.secret) {
			headers['X-OpsiMate-Signature'] = signCallback(target.secret, sentAt, body);
		}
		// A user header replaces a default whatever its casing: header names are
		// case-insensitive, and fetch would otherwise send both values joined.
		for (const [key, value] of Object.entries(target.headers ?? {})) {
			for (const existing of Object.keys(headers)) {
				if (existing.toLowerCase() === key.toLowerCase()) delete headers[existing];
			}
			headers[key] = value;
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
		try {
			const res = await this.fetchImpl(target.url, {
				method: target.method,
				headers,
				body,
				signal: controller.signal,
				// Never follow a redirect: the configured headers carry the receiver's
				// credentials, and fetch would forward them to wherever the redirect points.
				redirect: 'manual',
			});
			if (res.ok) return { ok: true, statusCode: res.status, message: `Delivered (${res.status})` };
			if (res.status >= 300 && res.status < 400) {
				return {
					ok: false,
					statusCode: res.status,
					message: `HTTP ${res.status}: redirects are not followed, point the callback at the final URL`,
				};
			}
			const text = await res.text().catch(() => '');
			return {
				ok: false,
				statusCode: res.status,
				message: `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}${text ? ` - ${text.slice(0, 200)}` : ''}`,
			};
		} catch (error) {
			const message =
				error instanceof Error && error.name === 'AbortError'
					? `Timed out after ${this.requestTimeoutMs}ms`
					: error instanceof Error
						? error.message
						: String(error);
			return { ok: false, message };
		} finally {
			clearTimeout(timer);
		}
	}
}

// The signed string is "<unix seconds>.<body>", so a receiver can refuse a replayed
// request even when a custom body template carries no timestamp of its own.
export const signCallback = (secret: string, sentAt: number, body: string): string =>
	`sha256=${createHmac('sha256', secret).update(`${sentAt}.${body}`).digest('hex')}`;

// The JSON payload, or the body template resolved against it. Template variables: the
// alert variables actions use (from the first alert) plus the callback ones
// (ALERT_CALLBACK_TEMPLATE_VARIABLES). {{payload}} is the whole JSON document, for
// receivers that want it nested under their own envelope.
export const renderBody = (bodyTemplate: string | null | undefined, payload: AlertCallbackPayload): string => {
	const json = JSON.stringify(payload);
	if (!bodyTemplate?.trim()) return json;
	const ctx: Record<string, string> = {
		...buildAlertContext(payload.alerts[0] ?? {}),
		event: payload.event,
		timestamp: payload.timestamp,
		'actor.name': payload.actor.name ?? '',
		'actor.id': payload.actor.id ?? '',
		count: String(payload.alerts.length),
		alertIds: payload.alerts.map((alert) => alert.id).join(','),
		payload: json,
	};
	return resolvePlaceholders(bodyTemplate, ctx);
};

export const buildSamplePayload = (now: Date = new Date()): AlertCallbackPayload => {
	const startedAt = new Date(now.getTime() - 5 * 60_000).toISOString();
	return {
		event: 'silenced',
		timestamp: now.toISOString(),
		actor: { id: '1', name: 'Test User' },
		alerts: [
			{
				id: 'test-alert-1',
				type: 'Custom',
				status: 'firing' as Alert['status'],
				severity: 'critical' as Alert['severity'],
				tags: { env: 'prod', team: 'platform', severity: 'critical' },
				startsAt: startedAt,
				updatedAt: now.toISOString(),
				alertUrl: 'https://example.com/alerts/test-alert-1',
				alertName: 'Test alert from OpsiMate',
				summary: 'This is a test callback sent from OpsiMate.',
				runbookUrl: 'https://example.com/runbooks/demo-service',
				createdAt: startedAt,
				isSilenced: true,
				silencedUntil: null,
				ownerId: '1',
			},
		],
		details: { silencedUntil: null, comment: 'Looking into it' },
		bulk: false,
	};
};
