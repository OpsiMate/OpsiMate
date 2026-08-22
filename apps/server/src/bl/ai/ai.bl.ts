import {
	AiConfig,
	AiFilterResult,
	AiStatus,
	AiTestResult,
	AlertFacetsResult,
	AuditActionType,
	AuditResourceType,
	Logger,
	UpdateAiConfig,
	User,
} from '@OpsiMate/shared';
import { AiConfigRepository } from '../../dal/aiConfigRepository';
import { decryptPassword, encryptPassword } from '../../utils/encryption';
import { AuditBL } from '../audit/audit.bl';

const logger = new Logger('bl/ai.bl');

// Bedrock API keys authenticate with a plain bearer token against the Converse REST
// API, so no AWS SDK or SigV4 signing is needed. A custom base URL (e.g. a LiteLLM
// proxy) stored in the config takes priority; the env var is a last-resort override
// for tests that point it at a local mock server.
const bedrockEndpoint = (region: string, baseUrl?: string): string =>
	baseUrl || process.env.AI_BEDROCK_ENDPOINT || `https://bedrock-runtime.${region}.amazonaws.com`;

// Does an IPv4 literal fall in a range we must never send the key to? Covers loopback,
// the RFC1918 private blocks, link-local (which includes the 169.254.169.254 cloud
// metadata address), CGNAT, and the "this host" 0.0.0.0/8.
const isBlockedIPv4 = ([a, b]: number[]): boolean =>
	a === 0 ||
	a === 10 ||
	a === 127 ||
	(a === 169 && b === 254) ||
	(a === 172 && b >= 16 && b <= 31) ||
	(a === 192 && b === 168) ||
	(a === 100 && b >= 64 && b <= 127);

// Parse a strict dotted-quad; returns null for anything that isn't four 0-255 octets.
const parseIPv4 = (host: string): number[] | null => {
	const parts = host.split('.');
	if (parts.length !== 4) return null;
	const octets = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
	return octets.every((n) => n >= 0 && n <= 255) ? octets : null;
};

// IPv6 loopback (::1), unspecified (::), unique-local (fc00::/7), link-local
// (fe80::/10), and IPv4-mapped forms that smuggle a blocked v4 address in.
const isBlockedIPv6 = (host: string): boolean => {
	if (!host.includes(':')) return false;
	if (host === '::1' || host === '::') return true;
	if (host.startsWith('fc') || host.startsWith('fd') || /^fe[89ab]/.test(host)) return true;
	if (host.startsWith('::ffff:')) {
		const mapped = parseIPv4(host.slice('::ffff:'.length));
		return mapped ? isBlockedIPv4(mapped) : false;
	}
	return false;
};

// A user-supplied base URL becomes the request target that receives the DECRYPTED API
// key as a bearer token. Left unchecked, an admin (or a hijacked admin session) could
// point it at an internal or attacker-controlled host and exfiltrate the write-only
// key, or reach the cloud metadata service. Require https, forbid embedded credentials
// and query/fragment, and block loopback / private / link-local / metadata hosts.
// The AI_BEDROCK_ENDPOINT env override is operator-controlled (not request input), so it
// is intentionally exempt — that is how tests point at a local mock.
export const assertSafeAiEndpoint = (rawBaseUrl: string): void => {
	let url: URL;
	try {
		url = new URL(rawBaseUrl);
	} catch {
		throw new AiValidationError('Endpoint must be a valid absolute URL.');
	}
	if (url.protocol !== 'https:') {
		throw new AiValidationError('Endpoint must use https.');
	}
	if (url.username || url.password) {
		throw new AiValidationError('Endpoint must not embed credentials.');
	}
	if (url.search || url.hash) {
		throw new AiValidationError('Endpoint must not include a query string or fragment.');
	}
	const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
	const blockedName =
		host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal');
	const v4 = parseIPv4(host);
	if (blockedName || (v4 && isBlockedIPv4(v4)) || isBlockedIPv6(host)) {
		throw new AiValidationError('Endpoint host is not allowed.');
	}
};

// Same budget the actions executor gives outbound calls: slow enough for a cold model,
// fast enough that a wrong region (connection black-holes) fails while the user is
// still looking at the button.
const TEST_TIMEOUT_MS = 15_000;

// Bedrock error bodies are inconsistent about casing ({"Message": ...} from the auth
// layer, {"message": ...} from the runtime), and the exception class only appears in
// the x-amzn-errortype header — read all three.
interface BedrockConverseResponse {
	output?: { message?: { content?: Array<{ text?: string; toolUse?: { name?: string; input?: unknown } }> } };
	message?: string;
	Message?: string;
}

// Outcome of one Converse round trip, shared by the test button and every feature call.
interface ConverseOutcome {
	ok: boolean;
	latencyMs: number;
	status: number;
	body: BedrockConverseResponse;
	errorMessage: string | null;
}

export class AiBL {
	constructor(
		private aiConfigRepo: AiConfigRepository,
		private auditBL: AuditBL,
		// The live facet vocabulary (fields, values, tag keys) used to ground and then
		// validate NL->filter translations. Injected so this BL stays free of alert
		// internals.
		private getFacets: () => Promise<AlertFacetsResult>
	) {}

	// What any authenticated user may know: whether AI features are usable at all.
	async getStatus(): Promise<AiStatus> {
		const row = await this.aiConfigRepo.getConfig();
		return { enabled: row.enabled === 1 && row.api_key != null && row.model_id.length > 0 };
	}

	// The stored key never leaves the server — the config the API returns carries only
	// whether one exists.
	async getConfig(): Promise<AiConfig> {
		const row = await this.aiConfigRepo.getConfig();
		return {
			provider: 'bedrock',
			region: row.region,
			modelId: row.model_id,
			baseUrl: row.base_url,
			enabled: row.enabled === 1,
			hasApiKey: row.api_key != null,
			updatedAt: row.updated_at,
		};
	}

	async updateConfig(updates: UpdateAiConfig, user?: User): Promise<AiConfig> {
		// A custom endpoint receives the decrypted key as a bearer token — vet it before it
		// is ever stored. An empty string means "fall back to the default", so only a
		// non-empty value is checked.
		if (updates.baseUrl) {
			assertSafeAiEndpoint(updates.baseUrl);
		}
		// Read, merge and write in ONE transaction (see mergeConfig): two partial updates
		// arriving together must not each read the same row and overwrite each other.
		const saved = await this.aiConfigRepo.mergeConfig((current) => {
			// apiKey: undefined keeps the stored ciphertext, null deletes, a string replaces.
			const apiKey =
				updates.apiKey === undefined
					? current.api_key
					: updates.apiKey === null
						? null
						: encrypt(updates.apiKey);
			// Removing the key silently disables the feature rather than 400-ing: the
			// user asked to delete a credential, and an enabled config with no key is
			// exactly the lie this guard exists to prevent. Only an EXPLICIT
			// `enabled: true` with no key is a client error worth rejecting.
			const enabled = updates.enabled !== undefined ? updates.enabled : current.enabled === 1 && apiKey != null;
			if (enabled && apiKey == null) {
				throw new AiValidationError('Cannot enable AI without an API key.');
			}
			return {
				provider: 'bedrock',
				region: updates.region ?? current.region,
				model_id: updates.modelId ?? current.model_id,
				base_url: updates.baseUrl ?? current.base_url,
				api_key: apiKey,
				enabled: enabled ? 1 : 0,
			};
		});
		// The audit trail records THAT the config changed and by whom — never key material.
		await this.auditBL.logAction({
			actionType: AuditActionType.UPDATE,
			resourceType: AuditResourceType.AI,
			resourceId: 'ai-config',
			userId: user ? Number(user.id) : 0,
			userName: user?.fullName ?? 'unknown',
			resourceName: 'AI settings',
			details: `${updates.apiKey !== undefined ? (updates.apiKey === null ? 'key removed, ' : 'key replaced, ') : ''}region=${saved.region}, model=${saved.model_id}, enabled=${saved.enabled === 1}`,
		});
		return {
			provider: 'bedrock',
			region: saved.region,
			modelId: saved.model_id,
			baseUrl: saved.base_url,
			enabled: saved.enabled === 1,
			hasApiKey: saved.api_key != null,
			updatedAt: saved.updated_at,
		};
	}

	// One Converse round trip with the SAVED configuration, shared by the test button
	// and every feature call. Never throws — errors come back as a message so callers
	// can surface Bedrock's own diagnosis (bad key vs bad model vs wrong region).
	private async converse(body: object): Promise<ConverseOutcome> {
		const row = await this.aiConfigRepo.getConfig();
		if (!row.api_key) {
			return { ok: false, latencyMs: 0, status: 0, body: {}, errorMessage: 'No API key is configured yet.' };
		}
		if (!row.model_id) {
			return { ok: false, latencyMs: 0, status: 0, body: {}, errorMessage: 'No model id is configured yet.' };
		}
		// Defense in depth: save-time validation keeps stored endpoints safe, but re-check a
		// user-supplied base URL before every call so a row that predates this guard (or was
		// written another way) still can't leak the key. The env override is exempt.
		if (row.base_url) {
			try {
				assertSafeAiEndpoint(row.base_url);
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Endpoint is not allowed.';
				return { ok: false, latencyMs: 0, status: 0, body: {}, errorMessage: message };
			}
		}

		const url = `${bedrockEndpoint(row.region, row.base_url || undefined)}/model/${encodeURIComponent(row.model_id)}/converse`;
		const started = Date.now();
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
			let response: Awaited<ReturnType<typeof fetch>>;
			let parsed: BedrockConverseResponse;
			try {
				response = await fetch(url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${decryptPassword(row.api_key)}`,
					},
					body: JSON.stringify(body),
					signal: controller.signal,
				});
				// The abort signal covers the BODY read too — a response that stalls
				// mid-stream must not hang past the budget.
				parsed = (await response.json().catch(() => ({}))) as BedrockConverseResponse;
			} finally {
				clearTimeout(timer);
			}
			const latencyMs = Date.now() - started;

			if (!response.ok) {
				// Bedrock error bodies are inconsistent about casing and the exception
				// class only appears in the x-amzn-errortype header — read all three.
				const errorType = (response.headers.get('x-amzn-errortype') ?? '').split(':')[0];
				const detail = parsed.message || parsed.Message || '';
				const reason = [errorType, detail].filter(Boolean).join(': ') || `HTTP ${response.status}`;
				logger.warn(`Bedrock call failed (${response.status}): ${reason}`);
				return { ok: false, latencyMs, status: response.status, body: parsed, errorMessage: reason };
			}
			return { ok: true, latencyMs, status: response.status, body: parsed, errorMessage: null };
		} catch (error) {
			const latencyMs = Date.now() - started;
			const message =
				error instanceof Error && error.name === 'AbortError'
					? `Timed out after ${TEST_TIMEOUT_MS / 1000}s — check the region.`
					: error instanceof Error
						? error.message
						: 'Unknown error';
			logger.warn(`Bedrock call errored: ${message}`);
			return { ok: false, latencyMs, status: 0, body: {}, errorMessage: message };
		}
	}

	// The Test Connection button — same contract actions and integrations follow.
	async testConnection(): Promise<AiTestResult> {
		const row = await this.aiConfigRepo.getConfig();
		const outcome = await this.converse({
			messages: [{ role: 'user', content: [{ text: 'Reply with the single word: ok' }] }],
			inferenceConfig: { maxTokens: 16 },
		});
		if (!outcome.ok) {
			return {
				ok: false,
				latencyMs: outcome.latencyMs,
				modelId: row.model_id,
				message: outcome.errorMessage ?? 'Unknown error',
			};
		}
		const reply = outcome.body.output?.message?.content?.map((c) => c.text ?? '').join('') || '(empty reply)';
		return { ok: true, latencyMs: outcome.latencyMs, modelId: row.model_id, message: reply.slice(0, 200) };
	}

	// Natural language -> the dashboard's filter record. The model is grounded on the
	// LIVE facet vocabulary and forced through a tool schema; afterwards every field
	// and value is validated against that same vocabulary, so a hallucinated value can
	// never reach the query engine — worst case a term is dropped and the user sees
	// fewer chips than expected.
	async filterFromText(query: string): Promise<AiFilterResult> {
		const status = await this.getStatus();
		if (!status.enabled) {
			throw new AiDisabledError();
		}

		const facets = await this.getFacets();
		const vocabulary = buildVocabulary(facets);

		const outcome = await this.converse({
			system: [
				{
					text:
						'You translate a natural-language description of alerts into structured filters for an alert dashboard. ' +
						'Use ONLY field names and values from the provided vocabulary (values are case-sensitive). ' +
						'Anything about alert NAMES or message text belongs in `search`, not in filters. ' +
						'Phrases like "not X" or "except X" become an exclusion: prefix the field name with "!". ' +
						'Time phrases ("last hour", "today") become lastMinutes. ' +
						'Unowned/unassigned alerts: owner=["Unassigned"]. ' +
						'Keep `explanation` to one short sentence describing your interpretation.',
				},
			],
			messages: [
				{
					role: 'user',
					content: [{ text: `Vocabulary:\n${JSON.stringify(vocabulary)}\n\nRequest: ${query}` }],
				},
			],
			toolConfig: {
				tools: [
					{
						toolSpec: {
							name: 'apply_alert_filters',
							description: 'Apply structured filters to the alert dashboard.',
							inputSchema: {
								json: {
									type: 'object',
									properties: {
										filters: {
											type: 'object',
											description:
												'Field -> allowed values. Keys are field names from the vocabulary, optionally prefixed with "!" for exclusion.',
											additionalProperties: { type: 'array', items: { type: 'string' } },
										},
										search: {
											type: 'string',
											description: 'Free-text search over alert names and messages.',
										},
										lastMinutes: {
											type: 'integer',
											minimum: 1,
											description: 'Rolling time window in minutes.',
										},
										explanation: { type: 'string' },
									},
									required: ['filters', 'explanation'],
								},
							},
						},
					},
				],
				toolChoice: { tool: { name: 'apply_alert_filters' } },
			},
			inferenceConfig: { maxTokens: 500 },
		});

		if (!outcome.ok) {
			throw new BedrockCallError(outcome.errorMessage ?? 'Bedrock call failed');
		}
		const toolUse = outcome.body.output?.message?.content?.find((c) => c.toolUse)?.toolUse;
		if (!toolUse || typeof toolUse.input !== 'object' || toolUse.input === null) {
			throw new BedrockCallError('The model returned no structured filters — try rephrasing the request.');
		}
		const raw = toolUse.input as {
			filters?: Record<string, unknown>;
			search?: unknown;
			lastMinutes?: unknown;
			explanation?: unknown;
		};

		return {
			filters: sanitizeFilters(raw.filters, facets),
			search: typeof raw.search === 'string' && raw.search.trim() ? raw.search.trim().slice(0, 200) : undefined,
			lastMinutes:
				typeof raw.lastMinutes === 'number' && Number.isFinite(raw.lastMinutes)
					? Math.min(Math.max(Math.round(raw.lastMinutes), 1), 7 * 24 * 60)
					: undefined,
			explanation:
				typeof raw.explanation === 'string' && raw.explanation.trim()
					? raw.explanation.trim().slice(0, 300)
					: 'Applied the interpreted filters.',
		};
	}
}

// Thrown when a feature call arrives while AI is not configured/enabled — the
// controller maps it to a 409 so the client can show "enable AI in settings".
export class AiDisabledError extends Error {
	constructor() {
		super('AI features are not enabled. Configure a Bedrock key in Settings → AI.');
	}
}

// A config update that must be rejected (maps to 400).
export class AiValidationError extends Error {}

// A Bedrock round trip that failed with a user-showable reason (maps to 502).
// Anything NOT wrapped in this stays a generic 500 — internal error text is never
// forwarded to clients.
export class BedrockCallError extends Error {}

// Fields whose values are a fixed enum rather than whatever currently exists: "not
// silenced" must validate even when nothing is silenced right now, and "resolved
// alerts" even when the archive is empty. Everything else (tags, types, owners)
// validates against the live vocabulary only.
const STATIC_FIELD_VALUES: Record<string, string[]> = {
	status: ['Firing', 'Muted', 'Silenced', 'Resolved'],
	severity: ['Critical', 'Warning', 'Info'],
};

// The grounding sent to the model: every filterable field with its live values (plus
// the static enums above). Values are capped per field to keep the prompt small;
// alertName is deliberately excluded — name matching belongs in `search`, and
// thousands of names would bloat every call.
const VOCAB_VALUE_CAP = 60;
const buildVocabulary = (facets: AlertFacetsResult): Record<string, string[]> => {
	const vocabulary: Record<string, string[]> = { ...STATIC_FIELD_VALUES };
	for (const [field, counts] of Object.entries(facets.facets)) {
		if (field === 'alertName') continue;
		const merged = new Set([...(vocabulary[field] ?? []), ...Object.keys(counts)]);
		vocabulary[field] = [...merged].slice(0, VOCAB_VALUE_CAP);
	}
	return vocabulary;
};

// Keep only fields that exist and, per field, only values the vocabulary actually
// contains (case-insensitive in, canonical casing out). "!field" exclusion keys
// validate against the same base field.
const sanitizeFilters = (
	raw: Record<string, unknown> | undefined,
	facets: AlertFacetsResult
): Record<string, string[]> => {
	const result: Record<string, string[]> = {};
	if (!raw) return result;
	for (const [key, values] of Object.entries(raw)) {
		if (!Array.isArray(values)) continue;
		const baseField = key.startsWith('!') ? key.slice(1) : key;
		const knownValues = [...(STATIC_FIELD_VALUES[baseField] ?? []), ...Object.keys(facets.facets[baseField] ?? {})];
		if (knownValues.length === 0 || baseField === 'alertName') continue;
		const canonical = new Map(knownValues.map((v) => [v.toLowerCase(), v]));
		const kept = values
			.filter((v): v is string => typeof v === 'string')
			.map((v) => canonical.get(v.toLowerCase()))
			.filter((v): v is string => v !== undefined);
		if (kept.length > 0) result[key] = [...new Set(kept)];
	}
	return result;
};

// Local alias so the encrypt call site reads symmetrically with decryptPassword.
const encrypt = (value: string): string => {
	const encrypted = encryptPassword(value);
	if (!encrypted) throw new Error('Failed to encrypt the API key');
	return encrypted;
};
