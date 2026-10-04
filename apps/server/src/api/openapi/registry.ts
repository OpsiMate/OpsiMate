import { z } from 'zod';

// One documented API route. The OpenAPI document (document.ts) is generated from these,
// and apiDocsCoverage.test.ts checks that every route the app really registers is either
// documented here or listed in pendingRoutes.ts, so the docs can't silently drift.

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

// Who may call the route:
// - public: no credentials
// - user:   a signed-in user (Bearer JWT) or the instance API token (x-api-token)
// - admin:  a signed-in user with the admin role (Bearer JWT)
export type ApiAuth = 'public' | 'user' | 'admin';

export interface ApiResponseDoc {
	description: string;
	// The JSON body; omitted for empty responses (e.g. 304).
	schema?: z.ZodType;
}

export interface ApiRouteDoc {
	method: HttpMethod;
	// Express-style path, exactly as the app registers it: /api/v1/alerts/:alertId
	path: string;
	tag: string;
	summary: string;
	description?: string;
	auth: ApiAuth;
	deprecated?: boolean;
	// Path parameters; any not described here are documented as plain strings.
	params?: z.ZodObject;
	query?: z.ZodObject;
	body?: z.ZodType;
	responses: Record<number, ApiResponseDoc>;
}

export interface ApiTagDoc {
	name: string;
	description: string;
}

// `{ success: true, data }` — the envelope every JSON endpoint answers with.
export const okEnvelope = <T extends z.ZodType>(data: T) => z.object({ success: z.literal(true), data });

export const ErrorResponseSchema = z
	.object({
		success: z.literal(false),
		error: z.string(),
		details: z.unknown().optional().describe('Validation issues, for 400 responses'),
	})
	.meta({ id: 'ErrorResponse' });

export const MessageResponseSchema = z.object({ success: z.literal(true), message: z.string() });

// Shorthands for the error responses most routes share.
export const errors = {
	validation: { description: 'Invalid request (details lists the problems)', schema: ErrorResponseSchema },
	unauthorized: { description: 'Missing or invalid credentials', schema: ErrorResponseSchema },
	forbidden: { description: 'Signed in, but not allowed (admin only)', schema: ErrorResponseSchema },
	notFound: { description: 'Not found', schema: ErrorResponseSchema },
	server: { description: 'Unexpected server error', schema: ErrorResponseSchema },
} satisfies Record<string, ApiResponseDoc>;
