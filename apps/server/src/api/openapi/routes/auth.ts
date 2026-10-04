import { LoginSchema, RegisterSchema, Role, User } from '@OpsiMate/shared';
import { z } from 'zod';
import { ApiRouteDoc, errors } from '../registry';

const UserResponseSchema: z.ZodType<User> = z
	.object({
		id: z.string(),
		email: z.string(),
		fullName: z.string(),
		role: z.enum(Role),
		createdAt: z.string(),
		phoneNumber: z.string().nullable().optional(),
		authSource: z.enum(['local', 'ldap']).optional().describe('ldap = signs in through the company directory'),
	})
	.meta({ id: 'User' });

const SignedInSchema = z.object({
	success: z.literal(true),
	data: UserResponseSchema,
	token: z.string().describe('JWT — send it as `Authorization: Bearer <token>`'),
});

export const authRoutes: ApiRouteDoc[] = [
	{
		method: 'post',
		path: '/api/v1/users/login',
		tag: 'Authentication',
		summary: 'Sign in',
		description:
			'Returns a JWT for the `Authorization: Bearer` header. Local accounts are checked against their ' +
			'password; when directory (LDAP) login is enabled, other emails are checked against the directory.',
		auth: 'public',
		body: LoginSchema,
		responses: {
			200: { description: 'Signed in', schema: SignedInSchema },
			400: errors.validation,
			401: { description: 'Invalid email or password', schema: errors.unauthorized.schema },
			403: {
				description: 'Directory account not in any group allowed to use OpsiMate',
				schema: errors.forbidden.schema,
			},
			429: {
				description: 'Too many failed directory logins for this email; try again later',
				schema: errors.server.schema,
			},
			503: { description: 'The directory (LDAP) is unreachable', schema: errors.server.schema },
		},
	},
	{
		method: 'post',
		path: '/api/v1/users/register',
		tag: 'Authentication',
		summary: 'Create the first admin',
		description: 'Only works while the instance has no users; afterwards admins create users.',
		auth: 'public',
		body: RegisterSchema,
		responses: {
			201: { description: 'Admin created and signed in', schema: SignedInSchema },
			400: errors.validation,
			403: { description: 'Registration is closed (users already exist)', schema: errors.forbidden.schema },
		},
	},
	{
		method: 'get',
		path: '/api/v1/users/exists',
		tag: 'Authentication',
		summary: 'Whether any user exists',
		description: 'Lets a fresh instance show "create the first admin" instead of the login page.',
		auth: 'public',
		responses: {
			200: { description: 'OK', schema: z.object({ success: z.literal(true), exists: z.boolean() }) },
		},
	},
];
