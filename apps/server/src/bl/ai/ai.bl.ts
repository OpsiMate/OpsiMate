import {
	AiConfig,
	AiTestResult,
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
// API, so no AWS SDK or SigV4 signing is needed. Overridable for tests, which point it
// at a local mock server.
const bedrockEndpoint = (region: string): string =>
	process.env.AI_BEDROCK_ENDPOINT ?? `https://bedrock-runtime.${region}.amazonaws.com`;

// Same budget the actions executor gives outbound calls: slow enough for a cold model,
// fast enough that a wrong region (connection black-holes) fails while the user is
// still looking at the button.
const TEST_TIMEOUT_MS = 15_000;

// Bedrock error bodies are inconsistent about casing ({"Message": ...} from the auth
// layer, {"message": ...} from the runtime), and the exception class only appears in
// the x-amzn-errortype header — read all three.
interface BedrockConverseResponse {
	output?: { message?: { content?: Array<{ text?: string }> } };
	message?: string;
	Message?: string;
}

export class AiBL {
	constructor(
		private aiConfigRepo: AiConfigRepository,
		private auditBL: AuditBL
	) {}

	// The stored key never leaves the server — the config the API returns carries only
	// whether one exists.
	async getConfig(): Promise<AiConfig> {
		const row = await this.aiConfigRepo.getConfig();
		return {
			provider: 'bedrock',
			region: row.region,
			modelId: row.model_id,
			enabled: row.enabled === 1,
			hasApiKey: row.api_key != null,
			updatedAt: row.updated_at,
		};
	}

	async updateConfig(updates: UpdateAiConfig, user?: User): Promise<AiConfig> {
		const current = await this.aiConfigRepo.getConfig();
		// apiKey: undefined keeps the stored ciphertext, null deletes, a string replaces.
		const apiKey =
			updates.apiKey === undefined ? current.api_key : updates.apiKey === null ? null : encrypt(updates.apiKey);
		await this.aiConfigRepo.saveConfig({
			provider: 'bedrock',
			region: updates.region ?? current.region,
			model_id: updates.modelId ?? current.model_id,
			api_key: apiKey,
			enabled: updates.enabled === undefined ? current.enabled : updates.enabled ? 1 : 0,
		});
		// The audit trail records THAT the config changed and by whom — never key material.
		await this.auditBL.logAction({
			actionType: AuditActionType.UPDATE,
			resourceType: AuditResourceType.AI,
			resourceId: 'ai-config',
			userId: user ? Number(user.id) : 0,
			userName: user?.fullName ?? 'unknown',
			resourceName: 'AI settings',
			details: `${updates.apiKey !== undefined ? (updates.apiKey === null ? 'key removed, ' : 'key replaced, ') : ''}region=${updates.region ?? current.region}, model=${updates.modelId ?? current.model_id}, enabled=${updates.enabled ?? current.enabled === 1}`,
		});
		return this.getConfig();
	}

	// One real, minimal Converse round trip with the SAVED configuration — the same
	// "Test" contract actions and integrations follow. Distinguishable outcomes: bad
	// key (401/403), bad model id (400/404), wrong region (network error), success
	// (the model's own reply text).
	async testConnection(): Promise<AiTestResult> {
		const row = await this.aiConfigRepo.getConfig();
		if (!row.api_key) {
			return { ok: false, latencyMs: 0, modelId: row.model_id, message: 'No API key is configured yet.' };
		}
		if (!row.model_id) {
			return { ok: false, latencyMs: 0, modelId: '', message: 'No model id is configured yet.' };
		}

		const url = `${bedrockEndpoint(row.region)}/model/${encodeURIComponent(row.model_id)}/converse`;
		const started = Date.now();
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${decryptPassword(row.api_key)}`,
				},
				body: JSON.stringify({
					messages: [{ role: 'user', content: [{ text: 'Reply with the single word: ok' }] }],
					inferenceConfig: { maxTokens: 16 },
				}),
				signal: controller.signal,
			});
			clearTimeout(timer);
			const latencyMs = Date.now() - started;
			const body = (await response.json().catch(() => ({}))) as BedrockConverseResponse;

			if (!response.ok) {
				const errorType = (response.headers.get('x-amzn-errortype') ?? '').split(':')[0];
				const detail = body.message || body.Message || '';
				const reason =
					[errorType, detail].filter(Boolean).join(': ') || `HTTP ${response.status}`;
				logger.warn(`Bedrock test failed (${response.status}): ${reason}`);
				return { ok: false, latencyMs, modelId: row.model_id, message: reason };
			}
			const reply = body.output?.message?.content?.map((c) => c.text ?? '').join('') || '(empty reply)';
			return { ok: true, latencyMs, modelId: row.model_id, message: reply.slice(0, 200) };
		} catch (error) {
			const latencyMs = Date.now() - started;
			const message =
				error instanceof Error && error.name === 'AbortError'
					? `Timed out after ${TEST_TIMEOUT_MS / 1000}s — check the region.`
					: error instanceof Error
						? error.message
						: 'Unknown error';
			logger.warn(`Bedrock test errored: ${message}`);
			return { ok: false, latencyMs, modelId: row.model_id, message };
		}
	}
}

// Local alias so the encrypt call site reads symmetrically with decryptPassword.
const encrypt = (value: string): string => {
	const encrypted = encryptPassword(value);
	if (!encrypted) throw new Error('Failed to encrypt the API key');
	return encrypted;
};
