import { CreateIntegrationSchema, IntegrationTagsquerySchema } from '@OpsiMate/shared';
import { z } from 'zod';
import { ApiRouteDoc, errors, MessageResponseSchema, okEnvelope } from '../registry';
import { IntegrationSchema } from '../schemas';

const IntegrationIdParams = z.object({ integrationId: z.string().regex(/^\d+$/).describe('Integration id') });

export const integrationRoutes: ApiRouteDoc[] = [
	{
		method: 'get',
		path: '/api/v1/integrations',
		tag: 'Integrations',
		summary: 'List integrations',
		description: 'Connected tools (Grafana, Kibana, Datadog). Credentials are never returned.',
		auth: 'user',
		responses: {
			200: { description: 'OK', schema: okEnvelope(z.object({ integrations: z.array(IntegrationSchema) })) },
			401: errors.unauthorized,
		},
	},
	{
		method: 'post',
		path: '/api/v1/integrations',
		tag: 'Integrations',
		summary: 'Add an integration',
		auth: 'user',
		body: CreateIntegrationSchema,
		responses: {
			201: { description: 'Created', schema: okEnvelope(IntegrationSchema) },
			400: errors.validation,
			401: errors.unauthorized,
		},
	},
	{
		method: 'put',
		path: '/api/v1/integrations/:integrationId',
		tag: 'Integrations',
		summary: 'Update an integration',
		auth: 'user',
		params: IntegrationIdParams,
		body: CreateIntegrationSchema,
		responses: {
			200: {
				description: 'Updated',
				schema: okEnvelope(IntegrationSchema).extend({ message: z.string() }),
			},
			400: errors.validation,
			401: errors.unauthorized,
		},
	},
	{
		method: 'delete',
		path: '/api/v1/integrations/:integrationId',
		tag: 'Integrations',
		summary: 'Remove an integration',
		auth: 'user',
		params: IntegrationIdParams,
		responses: { 200: { description: 'Removed', schema: MessageResponseSchema }, 401: errors.unauthorized },
	},
	{
		method: 'get',
		path: '/api/v1/integrations/:integrationId/urls',
		tag: 'Integrations',
		summary: 'Deep links into the integration for a set of tags',
		description: "e.g. the Grafana dashboards or Kibana views that match an alert's tags.",
		auth: 'user',
		params: IntegrationIdParams,
		query: IntegrationTagsquerySchema,
		responses: { 200: { description: 'OK', schema: okEnvelope(z.unknown()) }, 401: errors.unauthorized },
	},
	{
		method: 'post',
		path: '/api/v1/integrations/test-connection',
		tag: 'Integrations',
		summary: 'Test an integration before saving it',
		description:
			'Always 200: `success` and `data.isValidConnection` say whether the tool accepted the URL and credentials.',
		auth: 'user',
		body: CreateIntegrationSchema,
		responses: {
			200: {
				description: 'Test ran',
				schema: z.object({
					success: z.boolean(),
					error: z.string().optional(),
					data: z.object({ isValidConnection: z.boolean() }),
				}),
			},
			400: errors.validation,
			401: errors.unauthorized,
		},
	},
];
