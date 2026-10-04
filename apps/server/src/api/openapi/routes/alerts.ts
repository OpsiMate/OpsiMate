import { CreateCommentSchema } from '@OpsiMate/shared';
import { z } from 'zod';
import { ResolveAlertBodySchema, SetAlertOwnerSchema, SilenceAlertBodySchema } from '../../v1/alerts/models';
import { ApiRouteDoc, errors, MessageResponseSchema, okEnvelope } from '../registry';
import { AlertCommentSchema, AlertListResponseSchema, AlertSchema } from '../schemas';

// The list endpoints take `filters` as a JSON string in the query (it is parsed server-side),
// so the docs describe the wire format rather than the parsed runtime schema.
const AlertListQuery = z.object({
	filters: z
		.string()
		.optional()
		.describe('JSON object of field → allowed values, e.g. {"severity":["critical"],"tag:env":["production"]}'),
	from: z.string().optional().describe('ISO-8601 with offset; alerts active at or after this time'),
	to: z.string().optional().describe('ISO-8601 with offset'),
	search: z.string().optional().describe('Free-text search across names, summaries and tags'),
	sort: z.string().optional().describe('Field to sort by, e.g. startsAt, severity'),
	dir: z.enum(['asc', 'desc']).optional(),
	limit: z.number().int().min(1).max(1000).optional().describe('Page size'),
	cursor: z.string().optional().describe('`nextCursor` from the previous page'),
});

const LIST_DESCRIPTION =
	'Without query parameters: every alert, with an `ETag` — send it back as `If-None-Match` and an unchanged ' +
	'list answers `304` with no body (cheap polling). With any query parameter: one filtered, sorted page with ' +
	'`total` and `nextCursor`.';

const AlertIdParam = z.object({ alertId: z.string().describe('The alert id') });
const IdParam = z.object({ id: z.string().describe('The alert id') });

const alertResponse = okEnvelope(z.object({ alert: AlertSchema }));

const listResponses = {
	200: { description: 'OK', schema: AlertListResponseSchema },
	304: { description: 'Not modified since the ETag sent in If-None-Match' },
	400: errors.validation,
	401: errors.unauthorized,
};

export const alertRoutes: ApiRouteDoc[] = [
	{
		method: 'get',
		path: '/api/v1/alerts',
		tag: 'Alerts',
		summary: 'List firing alerts',
		description: LIST_DESCRIPTION,
		auth: 'user',
		query: AlertListQuery,
		responses: listResponses,
	},
	{
		method: 'get',
		path: '/api/v1/alerts/resolved',
		tag: 'Alerts',
		summary: 'List resolved alerts',
		description: LIST_DESCRIPTION,
		auth: 'user',
		query: AlertListQuery,
		responses: listResponses,
	},
	{
		method: 'delete',
		path: '/api/v1/alerts/:alertId',
		tag: 'Alerts',
		summary: 'Resolve an alert',
		description:
			'The UI\'s "Resolve" action: resolves the alert as the calling user (who becomes its owner), with an ' +
			'optional note stored as a comment. Despite the method, nothing is deleted — the alert moves to resolved ' +
			'history.\n\nWebhook senders: prefer `POST /api/v1/alerts/custom` with `"status": "resolved"`; using this ' +
			'route from a sender is deprecated.',
		auth: 'user',
		params: AlertIdParam,
		body: ResolveAlertBodySchema,
		responses: {
			200: { description: 'Resolved', schema: MessageResponseSchema },
			400: errors.validation,
			401: errors.unauthorized,
		},
	},
	{
		method: 'patch',
		path: '/api/v1/alerts/:id/silence',
		tag: 'Alerts',
		summary: 'Silence an alert',
		description: 'Optionally until a time (`silencedUntil`), and with a note stored as a comment.',
		auth: 'user',
		params: IdParam,
		body: SilenceAlertBodySchema,
		responses: {
			200: { description: 'Silenced', schema: alertResponse },
			400: errors.validation,
			401: errors.unauthorized,
			404: errors.notFound,
		},
	},
	{
		method: 'patch',
		path: '/api/v1/alerts/:id/unsilence',
		tag: 'Alerts',
		summary: 'Unsilence an alert',
		auth: 'user',
		params: IdParam,
		responses: {
			200: { description: 'Unsilenced', schema: alertResponse },
			401: errors.unauthorized,
			404: errors.notFound,
		},
	},
	{
		method: 'patch',
		path: '/api/v1/alerts/:id/read',
		tag: 'Alerts',
		summary: 'Mark an alert as read',
		auth: 'user',
		params: IdParam,
		responses: {
			200: { description: 'Marked read', schema: alertResponse },
			401: errors.unauthorized,
			404: errors.notFound,
		},
	},
	{
		method: 'patch',
		path: '/api/v1/alerts/:id/owner',
		tag: 'Alerts',
		summary: 'Set or clear the owner of an alert',
		auth: 'user',
		params: IdParam,
		body: SetAlertOwnerSchema,
		responses: {
			200: { description: 'Owner updated', schema: alertResponse },
			400: errors.validation,
			401: errors.unauthorized,
			404: errors.notFound,
		},
	},
	{
		method: 'get',
		path: '/api/v1/alerts/:alertId/comments',
		tag: 'Alerts',
		summary: "List an alert's comments",
		auth: 'user',
		params: AlertIdParam,
		responses: {
			200: { description: 'OK', schema: okEnvelope(z.object({ comments: z.array(AlertCommentSchema) })) },
			401: errors.unauthorized,
		},
	},
	{
		method: 'post',
		path: '/api/v1/alerts/:alertId/comments',
		tag: 'Alerts',
		summary: 'Comment on an alert',
		description: 'Needs a signed-in user (Bearer JWT): the comment is attributed to them.',
		auth: 'user',
		params: AlertIdParam,
		body: CreateCommentSchema,
		responses: {
			201: { description: 'Created', schema: okEnvelope(z.object({ comment: AlertCommentSchema })) },
			400: errors.validation,
			401: errors.unauthorized,
		},
	},
];
