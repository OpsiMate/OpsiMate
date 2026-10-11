import {
	Alert,
	AlertComment,
	AlertSeverity,
	AlertStatus,
	AlertType,
	CreateIntegrationSchema,
	IntegrationResponse,
} from '@OpsiMate/shared';
import { z } from 'zod';

// Response bodies for the API docs. Each is typed against the shared type it documents
// (z.ZodType<Alert>, …): if that type changes, the docs stop compiling instead of quietly
// describing the old shape.

const ALERT_TYPES = [
	'Grafana',
	'GCP',
	'Custom',
	'UptimeKuma',
	'Datadog',
	'Zabbix',
] as const satisfies readonly AlertType[];

const AlertLinkSchema = z.object({
	label: z.string(),
	icon: z.string().optional().describe('Icon slug, e.g. "grafana", "github"'),
	url: z.string(),
});

export const AlertSchema: z.ZodType<Alert> = z
	.object({
		id: z.string().describe('The id the sender gave the alert; re-sending the same id updates it'),
		type: z.enum(ALERT_TYPES).describe('Which integration created the alert'),
		status: z.enum(AlertStatus),
		severity: z.enum(AlertSeverity),
		team: z.string().nullable().optional(),
		tags: z.record(z.string(), z.string()),
		startsAt: z.string().describe('ISO-8601'),
		updatedAt: z.string().describe('ISO-8601'),
		alertUrl: z.string(),
		alertName: z.string(),
		summary: z.string().nullable().optional(),
		runbookUrl: z.string().nullable().optional(),
		links: z.array(AlertLinkSchema).optional(),
		createdAt: z.string().describe('ISO-8601'),
		isSilenced: z.boolean(),
		silencedUntil: z.string().nullable().optional().describe('null while silenced = silenced until unsilenced'),
		isRead: z.boolean().optional(),
		isMuted: z.boolean().optional().describe('An active mute policy matches this alert'),
		lastComment: z.string().nullable().optional(),
	})
	.meta({ id: 'Alert' });

export const AlertListResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		alerts: z.array(AlertSchema),
		total: z.number().int().optional().describe('With query parameters: matches across all pages'),
		nextCursor: z
			.string()
			.nullable()
			.optional()
			.describe('With query parameters: pass as `cursor` for the next page'),
	}),
});

export const AlertCommentSchema: z.ZodType<AlertComment> = z
	.object({
		id: z.string(),
		alertId: z.string(),
		userId: z.string(),
		comment: z.string(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.meta({ id: 'AlertComment' });

export const IntegrationSchema: z.ZodType<IntegrationResponse> = CreateIntegrationSchema.omit({ credentials: true })
	.extend({ id: z.number().int(), createdAt: z.string() })
	.meta({ id: 'Integration' });

// What every webhook answers when it accepted the payload.
export const WebhookAcceptedSchema = z.object({
	success: z.literal(true),
	data: z
		.object({
			alertId: z.string(),
			status: z.enum(['firing', 'resolved']).optional(),
			resolved: z.boolean().optional().describe('A resolve closed an alert that was firing'),
			created: z
				.boolean()
				.optional()
				.describe('A resolve for an alert that was never seen firing was recorded as a resolved episode'),
		})
		.nullable()
		.describe('null when the payload carried nothing to store (e.g. a test notification)'),
});
