import { getJwtSecret } from '../src/utils/jwtSecret';

describe('getJwtSecret', () => {
	// Env is passed in, so none of these touch the shared process.env.
	test.each([
		['unset', {}],
		['empty', { JWT_SECRET: '' }],
		['whitespace-only', { JWT_SECRET: '   ' }],
		// The public fallback this replaces: it must never be accepted again.
		['the old public fallback', { JWT_SECRET: 'changeme-secret' }],
		['31 bytes', { JWT_SECRET: 'x'.repeat(31) }],
		['31 bytes padded with spaces', { JWT_SECRET: `  ${'x'.repeat(31)}  ` }],
	])('refuses a JWT_SECRET that is %s', (_case, env) => {
		expect(() => getJwtSecret(env)).toThrow(/JWT_SECRET must be set/);
	});

	test('returns a JWT_SECRET of 32 bytes or more', () => {
		const secret = 'x'.repeat(32);

		expect(getJwtSecret({ JWT_SECRET: secret })).toBe(secret);
	});
});
