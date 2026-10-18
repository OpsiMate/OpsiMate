import { ApiResponse } from '@/lib/api';

// One line per problem, as the server sent them. Zod issues arrive as objects with a
// path ("roleMapping.admin.0") and a message; the server's own completeness checks
// arrive as strings naming the setting ("search_base", "bind_password (bind_dn is set)").
// Both are kept as "<field>: <what is wrong>" so the form can point at the field.
interface ZodIssueLike {
	path?: (string | number)[];
	message?: string;
}

const describe = (detail: unknown): string => {
	if (typeof detail === 'string') return detail;
	if (detail && typeof detail === 'object') {
		const { path, message } = detail as ZodIssueLike;
		const field = Array.isArray(path) ? path.filter((p) => typeof p === 'string').join('.') : '';
		return field ? `${field}: ${message ?? 'invalid'}` : (message ?? 'invalid');
	}
	return String(detail);
};

// A failed LDAP settings request with every problem the server named, not just the
// headline ("Validation error") — so a save or test can say which field to fix.
export class LdapRequestError extends Error {
	readonly problems: string[];

	constructor(response: ApiResponse<unknown>, fallback: string) {
		const details = Array.isArray(response.details) ? response.details : [];
		const problems = details.map(describe).filter(Boolean);
		super(
			problems.length > 0 ? `${response.error ?? fallback}: ${problems.join('; ')}` : (response.error ?? fallback)
		);
		this.name = 'LdapRequestError';
		this.problems = problems;
	}
}
