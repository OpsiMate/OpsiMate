import {
	ActionConfig,
	ActionOverrides,
	ActionPreview,
	ActionTestResult,
	ActionType,
	HttpActionConfig,
	JiraActionConfig,
	Logger,
	SlackActionConfig,
	TeamsActionConfig,
} from '@OpsiMate/shared';

const logger = new Logger('bl/actions/actionExecutor');

const REQUEST_TIMEOUT_MS = 10_000;

export interface ExecutableAction {
	name: string;
	type: ActionType;
	config: ActionConfig;
}

// Minimal alert shape needed to render action templates. Mirrors the shared Alert fields we use.
export interface AlertContextInput {
	id?: string;
	alertName?: string;
	status?: string;
	type?: string;
	summary?: string | null;
	startsAt?: string;
	updatedAt?: string;
	createdAt?: string;
	alertUrl?: string;
	runbookUrl?: string | null;
	tags?: Record<string, string>;
}

// Sample alert context used when testing an action, so templates render with realistic values.
export const buildSampleContext = (): Record<string, string> => ({
	'alert.name': 'Test alert from OpsiMate',
	'alert.service': 'demo-service',
	'alert.severity': 'critical',
	'alert.status': 'firing',
	'alert.summary': 'This is a test action triggered from OpsiMate.',
	'alert.startsAt': new Date().toISOString(),
});

// Context built from a real alert, used when running an action against an alert.
export const buildAlertContext = (alert: AlertContextInput): Record<string, string> => {
	const ctx: Record<string, string> = {
		'alert.name': alert.alertName ?? '',
		'alert.id': alert.id ?? '',
		'alert.status': alert.status ?? '',
		'alert.type': alert.type ?? '',
		'alert.summary': alert.summary ?? '',
		'alert.startsAt': alert.startsAt ?? '',
		'alert.updatedAt': alert.updatedAt ?? '',
		'alert.createdAt': alert.createdAt ?? '',
		'alert.url': alert.alertUrl ?? '',
		'alert.runbookUrl': alert.runbookUrl ?? '',
		'alert.severity': alert.tags?.severity ?? '',
		'alert.service': alert.tags?.service ?? '',
	};
	for (const [key, value] of Object.entries(alert.tags ?? {})) {
		ctx[`alert.tags.${key}`] = String(value);
	}
	return ctx;
};

const resolvePlaceholders = (template: string | null | undefined, ctx: Record<string, string>): string => {
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
	let key = '';
	try {
		key = (JSON.parse(respText) as { key?: string }).key ?? '';
	} catch {
		key = '';
	}
	return { ok: true, statusCode: res.status, message: key ? `Created Jira issue ${key}.` : 'Jira issue created.' };
};

const sendHttp = async (
	cfg: HttpActionConfig,
	body: string,
	ctx: Record<string, string>
): Promise<ActionTestResult> => {
	const url = resolvePlaceholders(cfg.url, ctx);
	const headers: Record<string, string> = {};
	for (const [key, value] of Object.entries(cfg.headers ?? {})) {
		headers[key] = resolvePlaceholders(value, ctx);
	}
	const hasBody = ['POST', 'PUT', 'PATCH'].includes(cfg.method) && !!body;
	if (hasBody && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
		headers['Content-Type'] = 'application/json';
	}
	const res = await fetchWithTimeout(url, { method: cfg.method, headers, body: hasBody ? body : undefined });
	const respText = await res.text().catch(() => '');
	return {
		ok: res.ok,
		statusCode: res.status,
		message: res.ok
			? `Request succeeded (${res.status} ${res.statusText}).`
			: `Request failed: ${res.status} ${res.statusText}${respText ? ` - ${respText.slice(0, 200)}` : ''}`,
	};
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
				return await sendHttp(action.config as HttpActionConfig, body, ctx);
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
		logger.error(`Failed to execute action '${action.name}'`, error);
		return { ok: false, message: errMessage };
	}
};
