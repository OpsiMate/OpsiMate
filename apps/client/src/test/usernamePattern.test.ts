import { describe, expect, test } from 'vitest';
import { USERNAME_HTML_PATTERN, USERNAME_PATTERN, UsernameSchema } from '@OpsiMate/shared';

// The HTML `pattern` on the username fields is the server's rule. Browsers compile it with
// the `v` flag and silently ignore a pattern that does not compile (an unescaped hyphen in a
// character class does not), so the form would accept what the server then rejects.

describe('USERNAME_HTML_PATTERN', () => {
	test('compiles under the v flag and agrees with the server schema', () => {
		const html = new RegExp(`^(?:${USERNAME_HTML_PATTERN})$`, 'v');
		for (const [value, ok] of [
			['a-b', true],
			['j.smith', true],
			['svc_deploy-01', true],
			['a!', false],
			['a', false],
			['Idan', false],
			['idan@x', false],
			['x'.repeat(65), false],
		] as const) {
			expect(html.test(value), value).toBe(ok);
			expect(USERNAME_PATTERN.test(value), value).toBe(ok);
			expect(UsernameSchema.safeParse(value).success, value).toBe(ok || value === 'Idan');
		}
	});
});
