import {
	ActionConfig,
	ActionOverrides,
	ActionPreview,
	ActionTestResult,
	ActionType,
	HttpActionConfig,
	HttpActionMethod,
	JiraActionConfig,
	Logger,
	SlackActionConfig,
	TeamsActionConfig,
	flagEmojiForCode,
} from '@OpsiMate/shared';
import http from 'node:http';
import https from 'node:https';
import { MS_PER_MINUTE, MS_PER_SECOND } from '../../utils/time';

const logger = new Logger('bl/actions/actionExecutor');

const REQUEST_TIMEOUT_MS = 10_000;

// How long a "don't wait for a response" request keeps its connection open for the
// answer nobody is waiting for. Long on purpose: the mode exists for receivers that
// answer only once their work is done, and some frameworks cancel that work when the
// client goes away. The socket is unref'd meanwhile, so it costs nothing at shutdown.
const FIRE_AND_FORGET_RESPONSE_WAIT_MS = 5 * MS_PER_MINUTE;

// A fresh connection per "don't wait" request. On a pooled keep-alive socket the
// receiver may have just closed, the write still succeeds into the kernel buffer and
// "sent" would be claimed for a request that only ever produces ECONNRESET.
const noWaitHttpAgent = new http.Agent({ keepAlive: false });
const noWaitHttpsAgent = new https.Agent({ keepAlive: false });

export interface ExecutableAction {
	name: string;
	type: ActionType;
	config: ActionConfig;
}

// Minimal alert shape needed to render action templates. Mirrors the shared Alert
// fields we use; every field tolerates null — real alerts carry nulls (custom alerts
// have type: null), and the context builder maps them to '' anyway.
export interface AlertContextInput {
	id?: string | null;
	alertName?: string | null;
	status?: string | null;
	type?: string | null;
	severity?: string | null;
	summary?: string | null;
	startsAt?: string | null;
	updatedAt?: string | null;
	createdAt?: string | null;
	alertUrl?: string | null;
	runbookUrl?: string | null;
	tags?: Record<string, string> | null;
}

// Expands a base field/tag map into the full variable context: every field under its
// short canonical name ({{name}}) AND the alert.* alias; every tag as {{label.<key>}}
// with {{tag.<key>}} and {{alert.tags.<key>}} aliases. Short names are what the picker
// offers; the aliases keep every previously-written template resolving.
const expandContext = (fields: Record<string, string>, tags: Record<string, string>): Record<string, string> => {
	const ctx: Record<string, string> = {};
	for (const [key, value] of Object.entries(fields)) {
		ctx[key] = value;
		ctx[`alert.${key}`] = value;
	}
	for (const [key, value] of Object.entries(tags)) {
		ctx[`label.${key}`] = String(value);
		ctx[`tag.${key}`] = String(value);
		ctx[`alert.tags.${key}`] = String(value);
		// {{flag.<key>}}: the flag for a two-letter country-code label, '' otherwise.
		ctx[`flag.${key}`] = flagEmojiForCode(String(value));
	}
	return ctx;
};

// Sample alert context used when testing an action, so templates render with realistic
// values. Covers EVERY variable in ALERT_TEMPLATE_VARIABLES (asserted by test) — a test
// run must resolve the same variables a real run would, or a template that works in Test
// ships with literal {{...}} left in it. Timestamps are chronological: created/started
// in the past, updated now.
export const buildSampleContext = (): Record<string, string> => {
	const now = Date.now();
	const fiveMinutesAgo = new Date(now - 5 * MS_PER_MINUTE).toISOString();
	return expandContext(
		{
			name: 'Test alert from OpsiMate',
			id: 'test-alert-1',
			status: 'firing',
			type: 'custom',
			summary: 'This is a test action triggered from OpsiMate.',
			severity: 'critical',
			service: 'demo-service',
			startsAt: fiveMinutesAgo,
			updatedAt: new Date(now).toISOString(),
			createdAt: fiveMinutesAgo,
			url: 'https://example.com/alerts/test-alert-1',
			runbookUrl: 'https://example.com/runbooks/demo-service',
		},
		{ env: 'prod', team: 'platform', site: 'IL' }
	);
};

// Context built from a real alert, used when running an action against an alert.
export const buildAlertContext = (alert: AlertContextInput): Record<string, string> => {
	return expandContext(
		{
			name: alert.alertName ?? '',
			id: alert.id ?? '',
			status: alert.status ?? '',
			type: alert.type ?? '',
			summary: alert.summary ?? '',
			startsAt: alert.startsAt ?? '',
			updatedAt: alert.updatedAt ?? '',
			createdAt: alert.createdAt ?? '',
			url: alert.alertUrl ?? '',
			runbookUrl: alert.runbookUrl ?? '',
			// First-class severity wins; the tag is kept as a fallback for older callers.
			severity: alert.severity ?? alert.tags?.severity ?? '',
			service: alert.tags?.service ?? '',
		},
		alert.tags ?? {}
	);
};

export const resolvePlaceholders = (template: string | null | undefined, ctx: Record<string, string>): string => {
	if (!template) return '';
	return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => (key in ctx ? ctx[key] : `{{${key}}}`));
};

// The concrete, ready-to-send text fields after template resolution. Only some are used per type.
interface RenderedFields {
	message: string;
	title: string;
	summary: string;
	description: string;
	body: string;
}

const renderFields = (action: ExecutableAction, ctx: Record<string, string>): RenderedFields => {
	const base: RenderedFields = { message: '', title: '', summary: '', description: '', body: '' };
	switch (action.type) {
		case 'slack': {
			const cfg = action.config as SlackActionConfig;
			return {
				...base,
				message: resolvePlaceholders(cfg.messageTemplate, ctx) || `:bell: OpsiMate — ${ctx['alert.name']}`,
			};
		}
		case 'teams': {
			const cfg = action.config as TeamsActionConfig;
			return {
				...base,
				title: resolvePlaceholders(cfg.titleTemplate, ctx) || 'OpsiMate alert',
				message: resolvePlaceholders(cfg.messageTemplate, ctx) || `${ctx['alert.name']}`,
			};
		}
		case 'jira': {
			const cfg = action.config as JiraActionConfig;
			return {
				...base,
				summary: resolvePlaceholders(cfg.summaryTemplate, ctx) || `[OpsiMate] ${ctx['alert.name']}`,
				description: resolvePlaceholders(cfg.descriptionTemplate, ctx),
			};
		}
		case 'http':
		default: {
			const cfg = action.config as HttpActionConfig;
			return { ...base, body: resolvePlaceholders(cfg.bodyTemplate, ctx) };
		}
	}
};

// Returns the exact content that would be sent, with templates resolved against the given context.
export const previewAction = (action: ExecutableAction, ctx: Record<string, string>): ActionPreview => {
	const f = renderFields(action, ctx);
	switch (action.type) {
		case 'slack': {
			const cfg = action.config as SlackActionConfig;
			return { type: 'slack', message: f.message, channel: cfg.channel ?? null, webhookUrl: cfg.webhookUrl };
		}
		case 'teams': {
			const cfg = action.config as TeamsActionConfig;
			return { type: 'teams', title: f.title, message: f.message, webhookUrl: cfg.webhookUrl };
		}
		case 'jira': {
			const cfg = action.config as JiraActionConfig;
			return {
				type: 'jira',
				summary: f.summary,
				description: f.description,
				baseUrl: cfg.baseUrl,
				projectKey: cfg.projectKey,
				issueType: cfg.issueType,
			};
		}
		case 'http':
		default: {
			const cfg = action.config as HttpActionConfig;
			return { type: 'http', method: cfg.method, url: resolvePlaceholders(cfg.url, ctx), body: f.body };
		}
	}
};

const fetchWithTimeout = async (url: string, options: RequestInit): Promise<Response> => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		return await fetch(url, { ...options, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
};

const sendSlack = async (cfg: SlackActionConfig, message: string): Promise<ActionTestResult> => {
	const body: Record<string, unknown> = { text: message };
	if (cfg.channel) body.channel = cfg.channel;
	const res = await fetchWithTimeout(cfg.webhookUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	const respText = await res.text().catch(() => '');
	return {
		ok: res.ok,
		statusCode: res.status,
		message: res.ok
			? 'Slack message sent successfully.'
			: `Slack returned ${res.status}: ${respText || res.statusText}`,
	};
};

const sendTeams = async (cfg: TeamsActionConfig, title: string, message: string): Promise<ActionTestResult> => {
	const card = {
		'@type': 'MessageCard',
		'@context': 'http://schema.org/extensions',
		summary: title || 'OpsiMate alert',
		title,
		text: message,
	};
	const res = await fetchWithTimeout(cfg.webhookUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(card),
	});
	const respText = await res.text().catch(() => '');
	return {
		ok: res.ok,
		statusCode: res.status,
		message: res.ok
			? 'Teams message sent successfully.'
			: `Teams returned ${res.status}: ${respText || res.statusText}`,
	};
};

const sendJira = async (cfg: JiraActionConfig, summary: string, description: string): Promise<ActionTestResult> => {
	const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString('base64');
	const fields: Record<string, unknown> = {
		project: { key: cfg.projectKey },
		issuetype: { name: cfg.issueType },
		summary,
	};
	if (description) {
		fields.description = {
			type: 'doc',
			version: 1,
			content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }],
		};
	}
	const url = `${cfg.baseUrl.replace(/\/$/, '')}/rest/api/3/issue`;
	const res = await fetchWithTimeout(url, {
		method: 'POST',
		headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({ fields }),
	});
	const respText = await res.text().catch(() => '');
	if (!res.ok) {
		return {
			ok: false,
			statusCode: res.status,
			message: `Jira returned ${res.status}: ${respText || res.statusText}`,
		};
	}
	let key: string;
	try {
		key = (JSON.parse(respText) as { key?: string }).key ?? '';
	} catch {
		key = '';
	}
	return { ok: true, statusCode: res.status, message: key ? `Created Jira issue ${key}.` : 'Jira issue created.' };
};

// The fully resolved HTTP request, shared by both send modes.
interface HttpRequestParts {
	url: string;
	method: HttpActionMethod;
	headers: Record<string, string>;
	body?: string;
}

const buildHttpRequest = (cfg: HttpActionConfig, body: string, ctx: Record<string, string>): HttpRequestParts => {
	const url = resolvePlaceholders(cfg.url, ctx);
	const headers: Record<string, string> = {};
	for (const [key, value] of Object.entries(cfg.headers ?? {})) {
		headers[key] = resolvePlaceholders(value, ctx);
	}
	const hasBody = ['POST', 'PUT', 'PATCH'].includes(cfg.method) && !!body;
	if (hasBody && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
		headers['Content-Type'] = 'application/json';
	}
	return { url, method: cfg.method, headers, body: hasBody ? body : undefined };
};

const sendHttpAndWait = async (parts: HttpRequestParts): Promise<ActionTestResult> => {
	const res = await fetchWithTimeout(parts.url, { method: parts.method, headers: parts.headers, body: parts.body });
	const respText = await res.text().catch(() => '');
	return {
		ok: res.ok,
		statusCode: res.status,
		message: res.ok
			? `Request succeeded (${res.status} ${res.statusText}).`
			: `Request failed: ${res.status} ${res.statusText}${respText ? ` - ${respText.slice(0, 200)}` : ''}`,
	};
};

// "Don't wait for a response": the result is decided the moment the request has been
// handed to the network, so a receiver that answers only once its work is done (or
// never) cannot hold up the user. Everything that can go wrong BEFORE that point — a
// wrong host, a refused port, a TLS failure, a connect timeout — still fails the run,
// exactly as in the waiting mode. The response, when it arrives, is only logged.
//
// Built on node:http rather than fetch because fetch has no "request sent" moment:
// its promise settles on response headers, and aborting it to stop waiting would also
// tear down the connection the receiver may still be working behind.
const sendHttpWithoutWaiting = (parts: HttpRequestParts, actionName: string): Promise<ActionTestResult> =>
	new Promise((resolve, reject) => {
		const target = new URL(parts.url);
		const isHttps = target.protocol === 'https:';
		const transport = isHttps ? https : http;
		let sent = false;
		let failed = false;
		let gaveUp = false;
		const fail = (error: Error) => {
			if (failed) return;
			failed = true;
			reject(error);
		};
		// Note: unlike fetch, node:http neither follows redirects nor rejects URLs with
		// userinfo (it turns them into Basic auth). A 3xx is logged with its Location.
		const options: http.RequestOptions = {
			method: parts.method,
			headers: parts.headers,
			agent: isHttps ? noWaitHttpsAgent : noWaitHttpAgent,
		};
		const req = transport.request(target, options, (res) => {
			// Nobody is waiting for this; drain it so the connection can close, and log it.
			res.resume();
			res.on('error', () => undefined);
			const status = res.statusCode ?? 0;
			const redirect = res.headers.location ? ` (redirect to ${res.headers.location}, not followed)` : '';
			const line = `Action '${actionName}' (not waiting): receiver answered ${status}${redirect}`;
			if (status >= 200 && status < 300) logger.info(line);
			else logger.warn(line);
		});
		req.on('error', (error: Error) => {
			if (!sent) {
				fail(error);
			} else if (!gaveUp) {
				logger.warn(
					`Action '${actionName}' (not waiting): connection ended before a response: ${error.message}`
				);
			}
		});
		// Wall-clock deadlines, like the waiting mode's AbortController. req.setTimeout
		// would not do: it only arms once the socket has connected (a black-holed host
		// would hang for the OS connect timeout) and it measures inactivity, so a receiver
		// trickling bytes could hold the socket forever.
		const sendDeadline = setTimeout(
			() => req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / MS_PER_SECOND}s.`)),
			REQUEST_TIMEOUT_MS
		);
		let responseDeadline: NodeJS.Timeout | undefined;
		req.once('close', () => {
			clearTimeout(sendDeadline);
			clearTimeout(responseDeadline);
		});
		req.once('finish', () => {
			clearTimeout(sendDeadline);
			// 'finish' can fire on a socket that already failed its write (a TLS handshake
			// against a plain-HTTP port surfaces as a write error): the 'error' event only
			// follows afterwards. That is a failed send, not a sent request.
			const socketFailure = req.socket?.errored;
			if (socketFailure) {
				fail(socketFailure);
				return;
			}
			if (!req.socket || req.socket.destroyed) {
				fail(new Error('Connection closed before the request was sent.'));
				return;
			}
			sent = true;
			resolve({ ok: true, message: `Request sent to ${target.host}; not waiting for a response.` });
			// The pending response must neither keep the process alive nor hold the socket forever.
			responseDeadline = setTimeout(() => {
				gaveUp = true;
				logger.info(`Action '${actionName}' (not waiting): gave up waiting for a response`);
				req.destroy();
			}, FIRE_AND_FORGET_RESPONSE_WAIT_MS).unref();
			req.socket.unref();
		});
		req.end(parts.body);
	});

// True when this action is configured to report success as soon as its request is sent.
export const sendsWithoutWaiting = (action: ExecutableAction): boolean =>
	action.type === 'http' && !!(action.config as HttpActionConfig).fireAndForget;

const sendHttp = (
	action: ExecutableAction,
	cfg: HttpActionConfig,
	body: string,
	ctx: Record<string, string>
): Promise<ActionTestResult> => {
	const parts = buildHttpRequest(cfg, body, ctx);
	return cfg.fireAndForget ? sendHttpWithoutWaiting(parts, action.name) : sendHttpAndWait(parts);
};

export const executeAction = async (
	action: ExecutableAction,
	ctx: Record<string, string>,
	overrides?: ActionOverrides
): Promise<ActionTestResult> => {
	const f = renderFields(action, ctx);
	const message = overrides?.message ?? f.message;
	const title = overrides?.title ?? f.title;
	const summary = overrides?.summary ?? f.summary;
	const description = overrides?.description ?? f.description;
	const body = overrides?.body ?? f.body;
	try {
		switch (action.type) {
			case 'slack':
				return await sendSlack(action.config as SlackActionConfig, message);
			case 'teams':
				return await sendTeams(action.config as TeamsActionConfig, title, message);
			case 'jira':
				return await sendJira(action.config as JiraActionConfig, summary, description);
			case 'http':
				return await sendHttp(action, action.config as HttpActionConfig, body, ctx);
			default:
				return { ok: false, message: `Unsupported action type: ${String(action.type)}` };
		}
	} catch (error) {
		const errMessage =
			error instanceof Error
				? error.name === 'AbortError'
					? 'Request timed out after 10s.'
					: error.message
				: 'Unknown error';
		// Log only the message, not the raw error object, to avoid leaking config secrets
		// (webhook URLs, Jira tokens) that may be embedded in the error/request context.
		logger.error(`Failed to execute action '${action.name}': ${errMessage}`);
		return { ok: false, message: errMessage };
	}
};
