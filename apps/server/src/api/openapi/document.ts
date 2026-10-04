import { z } from 'zod';
import { ApiAuth, ApiRouteDoc, ApiTagDoc, errors } from './registry';
import { alertRoutes } from './routes/alerts';
import { authRoutes } from './routes/auth';
import { integrationRoutes } from './routes/integrations';
import { webhookRoutes } from './routes/webhooks';

export const API_ROUTE_DOCS: ApiRouteDoc[] = [...authRoutes, ...webhookRoutes, ...alertRoutes, ...integrationRoutes];

const TAGS: ApiTagDoc[] = [
	{ name: 'Authentication', description: 'Sign in and get a token' },
	{ name: 'Webhooks', description: 'Send alerts into OpsiMate from your monitoring tools or your own code' },
	{ name: 'Alerts', description: 'Read and act on alerts' },
	{ name: 'Integrations', description: 'Connected tools that OpsiMate links out to' },
];

const DESCRIPTION = `The OpsiMate REST API.

## Authentication

Two ways to call protected routes:

- **API token** — the instance token from your config (\`security.api_token\`). Send it as the \`x-api-token\` header (or \`?api_token=\` for senders that can only call a URL). Meant for webhooks, scripts and automation.
- **Bearer JWT** — the token returned by \`POST /api/v1/users/login\`, as \`Authorization: Bearer <token>\`. Acts as that user, with their role; admin-only routes need it.

Every JSON response is \`{ "success": true, "data": … }\` or \`{ "success": false, "error": "…" }\`.`;

// OpenAPI holds JSON Schema 2020-12 as-is (3.1), so zod's own converter is enough. Named
// schemas (.meta({ id })) are emitted once under components and referenced elsewhere.
interface JsonSchemaWithDefs {
	$schema?: string;
	$defs?: Record<string, unknown>;
	[key: string]: unknown;
}

interface ConvertedSchema {
	schema: unknown;
	defs: Record<string, unknown>;
}

const DEFS_REF = '#/$defs/';
const COMPONENTS_REF = '#/components/schemas/';

const rewriteRefs = (node: unknown): unknown => {
	if (Array.isArray(node)) return node.map(rewriteRefs);
	if (node === null || typeof node !== 'object') return node;
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(node)) {
		out[key] =
			key === '$ref' && typeof value === 'string' && value.startsWith(DEFS_REF)
				? COMPONENTS_REF + value.slice(DEFS_REF.length)
				: rewriteRefs(value);
	}
	return out;
};

const convert = (schema: z.ZodType, io: 'input' | 'output'): ConvertedSchema => {
	const json = z.toJSONSchema(schema, { io, unrepresentable: 'any' }) as JsonSchemaWithDefs;
	const { $schema: _dialect, $defs, ...rest } = json;
	const defs: Record<string, unknown> = {};
	for (const [id, def] of Object.entries($defs ?? {})) defs[id] = rewriteRefs(def);
	// A named schema (.meta({ id })) comes back as a $ref plus its entry in $defs, so the
	// rewritten result is already a reference to its component.
	return { schema: rewriteRefs(rest), defs };
};

const SECURITY: Record<ApiAuth, Array<Record<string, string[]>>> = {
	public: [],
	user: [{ apiToken: [] }, { bearerAuth: [] }],
	admin: [{ bearerAuth: [] }],
};

const openApiPath = (expressPath: string): string => expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

const pathParamNames = (expressPath: string): string[] =>
	[...expressPath.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]);

export interface OpenApiDocumentOptions {
	version: string;
}

export const buildOpenApiDocument = (options: OpenApiDocumentOptions, routes: ApiRouteDoc[] = API_ROUTE_DOCS) => {
	const components: Record<string, unknown> = {};
	const use = (schema: z.ZodType, io: 'input' | 'output'): unknown => {
		const { schema: converted, defs } = convert(schema, io);
		Object.assign(components, defs);
		return converted;
	};

	const paths: Record<string, Record<string, unknown>> = {};
	for (const route of routes) {
		const paramShape: Record<string, z.ZodType | undefined> = route.params?.shape ?? {};
		const parameters = [
			...pathParamNames(route.path).map((name) => {
				const schema = paramShape[name];
				return {
					name,
					in: 'path',
					required: true,
					schema: schema ? use(schema, 'input') : { type: 'string' },
					...(schema?.description ? { description: schema.description } : {}),
				};
			}),
			...Object.entries(route.query?.shape ?? {}).map(([name, field]) => {
				const schema = field as z.ZodType;
				return {
					name,
					in: 'query',
					required: !schema.safeParse(undefined).success,
					schema: use(schema, 'input'),
					...(schema.description ? { description: schema.description } : {}),
				};
			}),
		];

		const responses: Record<string, unknown> = {};
		for (const [status, doc] of Object.entries(route.responses)) {
			responses[status] = {
				description: doc.description,
				...(doc.schema ? { content: { 'application/json': { schema: use(doc.schema, 'output') } } } : {}),
			};
		}
		if (route.auth !== 'public' && !responses['401']) {
			responses['401'] = {
				description: errors.unauthorized.description,
				content: { 'application/json': { schema: use(errors.unauthorized.schema, 'output') } },
			};
		}
		if (route.auth === 'admin' && !responses['403']) {
			responses['403'] = {
				description: errors.forbidden.description,
				content: { 'application/json': { schema: use(errors.forbidden.schema, 'output') } },
			};
		}

		const path = openApiPath(route.path);
		paths[path] ??= {};
		paths[path][route.method] = {
			tags: [route.tag],
			summary: route.summary,
			...(route.description ? { description: route.description } : {}),
			operationId: `${route.method}${route.path.replace(/^\/api\/v1/, '').replace(/[/:{}-]+(\w)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : ''))}`,
			...(route.deprecated ? { deprecated: true } : {}),
			security: SECURITY[route.auth],
			...(parameters.length > 0 ? { parameters } : {}),
			...(route.body
				? {
						requestBody: {
							// Bodies whose every field is optional (silence, resolve) may be omitted.
							required: !route.body.safeParse({}).success,
							content: { 'application/json': { schema: use(route.body, 'input') } },
						},
					}
				: {}),
			responses,
		};
	}

	return {
		openapi: '3.1.0',
		info: {
			title: 'OpsiMate API',
			version: options.version,
			description: DESCRIPTION,
			license: { name: 'AGPL-3.0', identifier: 'AGPL-3.0-only' },
		},
		// Relative: "Try it out" calls the server the docs were opened from.
		servers: [{ url: '/' }],
		tags: TAGS,
		paths,
		components: {
			securitySchemes: {
				apiToken: {
					type: 'apiKey',
					in: 'header',
					name: 'x-api-token',
					description: 'Instance API token (security.api_token)',
				},
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
					description: 'From POST /api/v1/users/login',
				},
			},
			schemas: components,
		},
	};
};
