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
export type CallbackTarget = Pick<AlertCallback, 'url' | 'method' | 'headers' | 'bodyTemplate'> & {
	secret?: string | null;
};

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

interface Delivery {
	callback: AlertCallback;
	payload: AlertCallbackPayload;
}

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
	private subscriptions: AlertCallback[] = [];
	private readonly lanes = new Map<number, Promise<void>>();
	private readonly batchScope = new AsyncLocalStorage<CallbackEventInput[]>();
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
			batch.push(input);
			return;
		}
		this.enqueue({
			event: input.event,
			timestamp: this.now().toISOString(),
			actor: input.actor,
			alerts: [input.alert],
			details: input.details ?? {},
			bulk: false,
		});
	}

	// Runs `fn` (a bulk operation) collecting its emits; when it finishes, each event
	// seen becomes ONE payload carrying every alert it touched. Per-alert details are
	// the same across a bulk operation, so the first alert's are used.
	async batched<T>(fn: () => Promise<T>): Promise<T> {
		const collected: CallbackEventInput[] = [];
		try {
			return await this.batchScope.run(collected, fn);
		} finally {
			this.flushBatch(collected);
		}
	}

	private flushBatch(collected: CallbackEventInput[]): void {
		if (collected.length === 0) return;
		const byEvent = new Map<AlertCallbackEvent, CallbackEventInput[]>();
		for (const input of collected) {
			const list = byEvent.get(input.event) ?? [];
			list.push(input);
			byEvent.set(input.event, list);
		}
		const timestamp = this.now().toISOString();
		for (const [event, inputs] of byEvent) {
			this.enqueue({
				event,
				timestamp,
				actor: inputs[0].actor,
				alerts: inputs.map((input) => input.alert),
				details: inputs[0].details ?? {},
				bulk: true,
			});
		}
	}

	private enqueue(payload: AlertCallbackPayload): void {
		for (const callback of this.subscriptions) {
			if (!callback.events.includes(payload.event)) continue;
			const lane = this.lanes.get(callback.id) ?? Promise.resolve();
			const next = lane.then(() => this.deliver({ callback, payload }));
			this.lanes.set(callback.id, next);
		}
	}

	// Resolves once every queued delivery has finished (tests and shutdown).
	async flush(): Promise<void> {
		await Promise.all([...this.lanes.values()]);
	}

	private async deliver({ callback, payload }: Delivery): Promise<void> {
		let result: SendResult = { ok: false, message: 'Not sent' };
		for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt++) {
			if (attempt > 0) await this.sleep(this.retryDelaysMs[attempt - 1]);
			result = await this.sendOnce(callback, payload);
			if (result.ok) break;
			logger.warn(
				`Callback "${callback.name}" (${payload.event}) attempt ${attempt + 1} failed: ${result.message}`
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

	private async sendOnce(target: CallbackTarget, payload: AlertCallbackPayload): Promise<SendResult> {
		const body = renderBody(target.bodyTemplate, payload);
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'User-Agent': 'OpsiMate-Callback/1',
			'X-OpsiMate-Event': payload.event,
			'X-OpsiMate-Delivery': randomUUID(),
		};
		if (target.secret) {
			headers['X-OpsiMate-Signature'] =
				`sha256=${createHmac('sha256', target.secret).update(body).digest('hex')}`;
		}
		for (const [key, value] of Object.entries(target.headers ?? {})) headers[key] = value;

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
		try {
			const res = await this.fetchImpl(target.url, {
				method: target.method,
				headers,
				body,
				signal: controller.signal,
			});
			if (res.ok) return { ok: true, statusCode: res.status, message: `Delivered (${res.status})` };
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
