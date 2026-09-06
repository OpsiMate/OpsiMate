import { z } from 'zod';
import { IntegrationType, Role, SecretType, RetentionResource } from './types';

export const CreateIntegrationSchema = z.object({
	name: z.string().min(1),
	type: z.nativeEnum(IntegrationType),
	externalUrl: z.string().url(),
	credentials: z
		.object({
			apiKey: z
				.string()
				.refine((val) => !/\s/.test(val), { message: 'API key cannot contain spaces' })
				.optional(),
			appKey: z
				.string()
				.refine((val) => !/\s/.test(val), { message: 'Application key cannot contain spaces' })
				.optional(),
		})
		.passthrough(),
});

export type Integration = z.infer<typeof CreateIntegrationSchema> & {
	id: number;
	createdAt: string;
};

export type IntegrationResponse = Omit<Integration, 'credentials'>;

export const IntegrationTagsquerySchema = z.object({
	tags: z.union([z.string(), z.array(z.string())]),
});

export const TagSchema = z.object({
	name: z.string().min(1, 'Tag name is required').max(50, 'Tag name must be less than 50 characters'),
	color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color'),
});

export const CreateTagSchema = TagSchema;

export const UpdateTagSchema = TagSchema.partial().extend({
	id: z.number(),
});

export const TagIdSchema = z.object({
	tagId: z.string().transform((val) => {
		const parsed = parseInt(val);
		if (isNaN(parsed)) {
			throw new Error('Invalid tag ID');
		}
		return parsed;
	}),
});

export const RoleSchema = z.nativeEnum(Role);

export const UserSchema = z.object({
	id: z.number(),
	email: z.string().email(),
	fullName: z.string(),
	role: RoleSchema,
	createdAt: z.string(),
});

export const CreateUserSchema = z.object({
	email: z.string().email(),
	fullName: z.string().min(1),
	password: z
		.string()
		.min(6)
		.refine((val) => !/\s/.test(val), {
			message: 'Password must not contain spaces',
		}),
	role: RoleSchema,
});

export const UpdateUserRoleSchema = z.object({
	email: z.string().email(),
	newRole: RoleSchema,
});

export const RegisterSchema = CreateUserSchema.omit({ role: true });

export const LoginSchema = z.object({
	email: z.string().email(),
	password: z
		.string()
		.min(6)
		.refine((val) => !/\s/.test(val), {
			message: 'Password must not contain spaces',
		}),
});

export const UpdateProfileSchema = z.object({
	fullName: z.string().min(1, 'Full name is required'),
	// Optional contact number; an empty string clears it. Formatting characters are
	// allowed, but the number must contain 7-15 digits (E.164 range) to be callable.
	phoneNumber: z
		.string()
		.trim()
		.max(30, 'Phone number is too long')
		.regex(/^\+?[\d\s()-]+$/, 'Invalid phone number')
		.refine((val) => {
			const digits = val.replace(/\D/g, '');
			return digits.length >= 7 && digits.length <= 15;
		}, 'Invalid phone number')
		.or(z.literal(''))
		.optional(),
	newPassword: z
		.string()
		.min(6, 'Password must be at least 6 characters')
		.refine((val) => !/\s/.test(val), {
			message: 'Password must not contain spaces',
		})
		.optional(),
});

export const CreateSecretsMetadataSchema = z.object({
	displayName: z.string().min(1, 'Secret name is required'),
	secretType: z.nativeEnum(SecretType).optional().default(SecretType.SSH),
});

export const UpdateSecretsMetadataSchema = z.object({
	displayName: z.string().min(1, 'Secret name is required').optional(),
	secretType: z.nativeEnum(SecretType).optional(),
});

export const ForgotPasswordSchema = z.object({
	email: z.string().email('Invalid email format'),
});

export const ValidateResetTokenSchema = z.object({
	token: z.string().min(1, 'Token is required'),
});

export const ResetPasswordSchema = z.object({
	token: z.string().min(1, 'Token is required'),
	newPassword: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.refine((val) => !/\s/.test(val), {
			message: 'Password must not contain spaces',
		}),
});

export const CreateDashboardSchema = z.object({
	name: z.string(),
	type: z.enum(['services', 'alerts']),
	description: z.string().optional(),
	filters: z.record(z.string(), z.unknown()),
	visibleColumns: z.array(z.string()),
	columnOrder: z.array(z.string()).optional(),
	// Positive finite px per column id; a map that could carry 0/NaN would render
	// invisible columns on every load of the saved view.
	columnWidths: z.record(z.string(), z.number().positive().finite()).optional(),
	// Alerts toolbar toggles. This schema validates BOTH create and update (the controller
	// reuses it), so adding them here is enough for edits to keep them.
	splitByAssignment: z.boolean().optional(),
	severityColors: z.boolean().optional(),
	query: z.string(),
	groupBy: z.array(z.string()),
	timeRange: z
		.object({
			from: z.string().nullable(),
			to: z.string().nullable(),
			preset: z.string().nullable(),
		})
		.optional(),
});

export const DashboardIdSchema = z.object({
	dashboardId: z.string().transform((val) => {
		const parsed = parseInt(val);
		if (isNaN(parsed)) {
			throw new Error('Invalid dashboard ID');
		}
		return parsed;
	}),
});

export const DashboardTagSchema = z.object({
	dashboardId: z.number(),
	tagId: z.number(),
});

export const CreateCommentSchema = z.object({
	comment: z.string().min(1, 'Comment cannot be empty').max(5000, 'Comment is too long'),
});

export const UpdateCommentSchema = z.object({
	comment: z.string().min(1, 'Comment cannot be empty').max(5000, 'Comment is too long'),
});

const labelMatcherSchema = z.object({
	key: z.string().min(1, 'Label key is required').max(200),
	value: z.string().min(1, 'Label value is required').max(500),
	op: z.enum(['equals', 'contains']).optional(),
});

const timeOfDayRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const mutePolicyScheduleSchema = z
	.object({
		daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, 'Select at least one day of week').max(7),
		startTime: z.string().regex(timeOfDayRegex, 'Start time must be HH:MM (24h)'),
		endTime: z.string().regex(timeOfDayRegex, 'End time must be HH:MM (24h)'),
	})
	.refine((s) => s.endTime > s.startTime, {
		message: 'End time must be after start time',
		path: ['endTime'],
	});

const mutePolicyTimeRefinement = (data: { startsAt?: string | null; endsAt?: string | null }) => {
	if (data.startsAt && data.endsAt) {
		return new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime();
	}
	return true;
};

// OR groups: array of AND-groups, each a non-empty matcher list.
const labelMatcherGroupsSchema = z.array(z.array(labelMatcherSchema).min(1).max(20)).max(20);

const mutePolicyMatchersRefinement = (data: {
	nameContains?: string | null;
	nameContainsAny?: string[] | null;
	labelMatchers?: unknown[];
	labelMatcherGroups?: unknown[];
	matchAll?: boolean;
}) => {
	if (data.matchAll) return true;
	const hasName =
		(!!data.nameContains && data.nameContains.trim().length > 0) ||
		(data.nameContainsAny ?? []).some((n) => (n ?? '').trim().length > 0);
	const hasMatchers = Array.isArray(data.labelMatchers) && data.labelMatchers.length > 0;
	const hasGroups = Array.isArray(data.labelMatcherGroups) && data.labelMatcherGroups.length > 0;
	return hasName || hasMatchers || hasGroups;
};

const mutePolicyScheduleExclusivityRefinement = (data: {
	startsAt?: string | null;
	endsAt?: string | null;
	schedule?: unknown;
}) => {
	if (!data.schedule) return true;
	return !data.startsAt && !data.endsAt;
};

export const CreateMutePolicySchema = z
	.object({
		name: z.string().min(1, 'Name is required').max(200),
		nameContains: z.string().max(500).optional().nullable(),
		// Name substrings ORed together; supersedes nameContains when present.
		nameContainsAny: z.array(z.string().min(1).max(500)).max(20).optional().nullable(),
		labelMatchers: z.array(labelMatcherSchema).max(20).optional().default([]),
		labelMatcherGroups: labelMatcherGroupsSchema.optional(),
		matchAll: z.boolean().optional().default(false),
		startsAt: z.string().datetime({ offset: true }).optional().nullable(),
		endsAt: z.string().datetime({ offset: true }).optional().nullable(),
		schedule: mutePolicyScheduleSchema.optional().nullable(),
		reason: z.string().max(1000).optional().nullable(),
	})
	.refine(mutePolicyTimeRefinement, { message: 'End time must be after start time', path: ['endsAt'] })
	.refine(mutePolicyMatchersRefinement, {
		message: 'Provide at least a name match, one label matcher, or enable match-all',
		path: ['nameContains'],
	})
	.refine(mutePolicyScheduleExclusivityRefinement, {
		message: 'A recurring schedule cannot be combined with a one-time window',
		path: ['schedule'],
	});

export const UpdateMutePolicySchema = z
	.object({
		name: z.string().min(1).max(200).optional(),
		nameContains: z.string().max(500).optional().nullable(),
		// Name substrings ORed together; supersedes nameContains when present.
		nameContainsAny: z.array(z.string().min(1).max(500)).max(20).optional().nullable(),
		labelMatchers: z.array(labelMatcherSchema).max(20).optional(),
		labelMatcherGroups: labelMatcherGroupsSchema.optional(),
		matchAll: z.boolean().optional(),
		startsAt: z.string().datetime({ offset: true }).optional().nullable(),
		endsAt: z.string().datetime({ offset: true }).optional().nullable(),
		schedule: mutePolicyScheduleSchema.optional().nullable(),
		reason: z.string().max(1000).optional().nullable(),
	})
	.refine(mutePolicyTimeRefinement, { message: 'End time must be after start time', path: ['endsAt'] })
	.refine(mutePolicyScheduleExclusivityRefinement, {
		message: 'A recurring schedule cannot be combined with a one-time window',
		path: ['schedule'],
	});

export const MutePolicyIdSchema = z.object({
	mutePolicyId: z.string().transform((val) => {
		const parsed = parseInt(val);
		if (isNaN(parsed)) {
			throw new Error('Invalid mute policy ID');
		}
		return parsed;
	}),
});

// ---- Alert enrichments ----

const enrichmentFieldSchema = z.object({
	key: z.string().min(1, 'Field key is required').max(200),
	value: z.string().min(1, 'Field value is required').max(1000),
});

// Enrichment links: url is NOT z.url() — label and url accept template placeholders
// ({{label.runbook}}, https://grafana/d/{{label.dashboard}}) resolved per-alert.
const enrichmentLinkSchema = z.object({
	label: z.string().min(1, 'Link label is required').max(200),
	icon: z.string().max(100).optional().default(''),
	url: z.string().min(1, 'Link URL is required').max(2000),
});

// At least one effect: a field to add/override, a link to add, or a summary template.
const enrichmentEffectRefinement = (data: {
	addFields?: unknown[];
	addLinks?: unknown[];
	summaryTemplate?: string | null;
}) => {
	const hasFields = Array.isArray(data.addFields) && data.addFields.length > 0;
	const hasLinks = Array.isArray(data.addLinks) && data.addLinks.length > 0;
	const hasSummary = !!data.summaryTemplate && data.summaryTemplate.trim().length > 0;
	return hasFields || hasLinks || hasSummary;
};

export const CreateAlertEnrichmentSchema = z
	.object({
		name: z.string().min(1, 'Name is required').max(200),
		nameContains: z.string().max(500).optional().nullable(),
		// Name substrings ORed together; supersedes nameContains when present.
		nameContainsAny: z.array(z.string().min(1).max(500)).max(20).optional().nullable(),
		labelMatchers: z.array(labelMatcherSchema).max(20).optional().default([]),
		labelMatcherGroups: labelMatcherGroupsSchema.optional(),
		matchAll: z.boolean().optional().default(false),
		addFields: z.array(enrichmentFieldSchema).max(20).optional().default([]),
		addLinks: z.array(enrichmentLinkSchema).max(20).optional().default([]),
		summaryTemplate: z.string().max(5000).optional().nullable(),
		priority: z.number().int().min(0).max(1000).optional().default(0),
	})
	.refine(mutePolicyMatchersRefinement, {
		message: 'Provide at least a name match, one label matcher, or enable match-all',
		path: ['nameContains'],
	})
	.refine(enrichmentEffectRefinement, {
		message: 'Provide at least one field to add, a link to add, or a summary template',
		path: ['addFields'],
	});

// Partial update: effect refinement is not enforced here because omitted fields mean
// "leave unchanged" (the client form always submits the full validated shape anyway).
export const UpdateAlertEnrichmentSchema = z.object({
	name: z.string().min(1).max(200).optional(),
	nameContains: z.string().max(500).optional().nullable(),
	// Name substrings ORed together; supersedes nameContains when present.
	nameContainsAny: z.array(z.string().min(1).max(500)).max(20).optional().nullable(),
	labelMatchers: z.array(labelMatcherSchema).max(20).optional(),
	labelMatcherGroups: labelMatcherGroupsSchema.optional(),
	matchAll: z.boolean().optional(),
	addFields: z.array(enrichmentFieldSchema).max(20).optional(),
	addLinks: z.array(enrichmentLinkSchema).max(20).optional(),
	summaryTemplate: z.string().max(5000).optional().nullable(),
	priority: z.number().int().min(0).max(1000).optional(),
});

export const AlertEnrichmentIdSchema = z.object({
	enrichmentId: z.string().transform((val) => {
		const parsed = parseInt(val);
		if (isNaN(parsed)) {
			throw new Error('Invalid enrichment ID');
		}
		return parsed;
	}),
});

// ---- Actions ----

const actionNameSchema = z.string().min(1, 'Name is required').max(200);

const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

const slackActionConfigSchema = z.object({
	webhookUrl: z.string().url('A valid Slack webhook URL is required'),
	channel: z.string().max(200).optional().nullable(),
	messageTemplate: z.string().max(5000).optional().nullable(),
});

const teamsActionConfigSchema = z.object({
	webhookUrl: z.string().url('A valid Teams webhook URL is required'),
	titleTemplate: z.string().max(500).optional().nullable(),
	messageTemplate: z.string().max(5000).optional().nullable(),
});

const jiraActionConfigSchema = z.object({
	baseUrl: z.string().url('A valid Jira base URL is required'),
	email: z.string().email('A valid email is required'),
	apiToken: z.string().min(1, 'API token is required').max(500),
	projectKey: z.string().min(1, 'Project key is required').max(50),
	issueType: z.string().min(1, 'Issue type is required').max(100),
	summaryTemplate: z.string().max(1000).optional().nullable(),
	descriptionTemplate: z.string().max(5000).optional().nullable(),
});

const httpActionConfigSchema = z.object({
	url: z.string().url('A valid URL is required'),
	method: httpMethodSchema,
	headers: z.record(z.string(), z.string()).optional().nullable(),
	bodyTemplate: z.string().max(10000).optional().nullable(),
});

// Optional alert filter shared by every action type. Empty = applies to all alerts.
const actionMatchFields = {
	nameContains: z.string().max(500).optional().nullable(),
	// Name substrings ORed together; supersedes nameContains when present.
	nameContainsAny: z.array(z.string().min(1).max(500)).max(20).optional().nullable(),
	labelMatchers: z.array(labelMatcherSchema).max(20).optional().default([]),
	labelMatcherGroups: labelMatcherGroupsSchema.optional(),
};

export const CreateActionSchema = z.discriminatedUnion('type', [
	z.object({
		...actionMatchFields,
		name: actionNameSchema,
		type: z.literal('slack'),
		config: slackActionConfigSchema,
	}),
	z.object({
		...actionMatchFields,
		name: actionNameSchema,
		type: z.literal('teams'),
		config: teamsActionConfigSchema,
	}),
	z.object({ ...actionMatchFields, name: actionNameSchema, type: z.literal('jira'), config: jiraActionConfigSchema }),
	z.object({ ...actionMatchFields, name: actionNameSchema, type: z.literal('http'), config: httpActionConfigSchema }),
]);

// Actions are replaced wholesale on edit, so update validates the same full shape as create.
export const UpdateActionSchema = CreateActionSchema;

export const ActionIdSchema = z.object({
	actionId: z.string().transform((val) => {
		const parsed = parseInt(val);
		if (isNaN(parsed)) {
			throw new Error('Invalid action ID');
		}
		return parsed;
	}),
});

// Body for running an action against a specific alert. Lenient on BOTH axes: extra
// alert fields pass through, and every known field tolerates null — real alerts carry
// nulls (custom alerts have type: null, many have no URL), and the executor already
// maps null/undefined to '' when building the template context. A strict field here
// turns "preview an ordinary alert" into a 400.
const alertContextSchema = z
	.object({
		id: z.string().nullish(),
		alertName: z.string().nullish(),
		status: z.string().nullish(),
		type: z.string().nullish(),
		summary: z.string().nullish(),
		startsAt: z.string().nullish(),
		updatedAt: z.string().nullish(),
		createdAt: z.string().nullish(),
		alertUrl: z.string().nullish(),
		runbookUrl: z.string().nullish(),
		tags: z.record(z.string(), z.string()).nullish(),
	})
	.passthrough();

export const PreviewActionSchema = z.object({
	alert: alertContextSchema,
});

const actionOverridesSchema = z.object({
	message: z.string().max(10000).optional(),
	title: z.string().max(1000).optional(),
	summary: z.string().max(1000).optional(),
	description: z.string().max(10000).optional(),
	body: z.string().max(20000).optional(),
});

export const RunActionSchema = z.object({
	alert: alertContextSchema,
	overrides: actionOverridesSchema.optional(),
});

export const UpdateRetentionPolicySchema = z
	.object({
		enabled: z.boolean().optional(),
		// 1 day .. 10 years
		retentionDays: z.number().int().min(1).max(3650).optional(),
	})
	.refine((v) => v.enabled !== undefined || v.retentionDays !== undefined, {
		message: 'Provide enabled and/or retentionDays',
	});

export const UpdateRetentionConfigSchema = z
	.object({
		// 1 hour .. 30 days
		cleanupIntervalHours: z.number().int().min(1).max(720).optional(),
		vacuumAfterCleanup: z.boolean().optional(),
	})
	.refine((v) => v.cleanupIntervalHours !== undefined || v.vacuumAfterCleanup !== undefined, {
		message: 'Provide cleanupIntervalHours and/or vacuumAfterCleanup',
	});

export const UpdateSilenceResetSettingsSchema = z
	.object({
		enabled: z.boolean().optional(),
		// Hour of day, server-local time.
		hour: z.number().int().min(0).max(23).optional(),
	})
	.refine((v) => v.enabled !== undefined || v.hour !== undefined, {
		message: 'Provide enabled and/or hour',
	});

// AI (BYOK) configuration update. apiKey: string replaces the stored key, null deletes
// it, absent keeps it. Region/model shapes are validated loosely on purpose — AWS adds
// regions and model ids faster than any hardcoded list stays correct.
export const UpdateAiConfigSchema = z
	.object({
		region: z
			.string()
			.trim()
			.min(1)
			.max(40)
			.regex(/^[a-z0-9-]+$/, 'Expected an AWS region like us-east-1')
			.optional(),
		modelId: z.string().trim().min(1).max(200).optional(),
		baseUrl: z.string().trim().max(500).optional(),
		// Don't trim the key itself (a real key never has surrounding space), but reject a
		// value that is only whitespace — otherwise it encrypts to a non-null "key" that
		// enables AI while sending an invalid bearer token.
		apiKey: z
			.string()
			.max(4096)
			.refine((value) => value.trim().length > 0, 'API key cannot be blank')
			.nullable()
			.optional(),
		enabled: z.boolean().optional(),
	})
	.refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

export const AiFilterQuerySchema = z.object({
	query: z.string().trim().min(2).max(400),
});

// "Bring your own" root cause, pushed by an external system (authenticated with the
// API token) after it learns the alertId from the ingest response. Callback URLs are
// hit server-side when an operator rates the analysis; they may point at internal
// hosts (self-hosted reality) but are validated against the metadata/link-local range
// before use. Content is capped so a webhook can't bloat the DB.
export const UpsertRootCauseSchema = z.object({
	content: z.string().min(1).max(65536),
	feedbackUpUrl: z.string().url().max(2048).optional(),
	feedbackDownUrl: z.string().url().max(2048).optional(),
});

export const RateRootCauseSchema = z.object({
	rating: z.enum(['up', 'down']),
});

export const RetentionResourceParamSchema = z.object({
	resourceType: z.nativeEnum(RetentionResource),
});

export const OncallTeamSchema = z.object({
	name: z.string().trim().min(1, 'Team name is required').max(100),
	// Days between rotation shifts; 0 or null keeps the order fixed.
	rotationIntervalDays: z.number().int().min(0).max(365).nullable().optional(),
});

export const OncallTeamMembersSchema = z.object({
	// Ordered list — the base call priority (before rotation) follows this order.
	userIds: z
		.array(z.coerce.number().int().positive())
		.max(50)
		.refine((ids) => new Set(ids).size === ids.length, 'Each user may appear only once'),
});
