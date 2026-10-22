import { afterEach, describe, expect, test, vi } from 'vitest';
import { Logger } from '@OpsiMate/shared';
import { redirectConsoleToStderr } from '../src/stdio';

// In stdio mode stdout carries the protocol. Everything the shared Logger can emit — a
// plain line, and the console.dir dump it uses for error details — must go through
// console.error (stderr) once redirected.
describe('redirectConsoleToStderr', () => {
	const original = { ...console };
	afterEach(() => {
		Object.assign(console, original);
		vi.restoreAllMocks();
	});

	test('every console channel the Logger uses ends up on console.error', () => {
		redirectConsoleToStderr();
		const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		const logger = new Logger('test');
		logger.info('hello');
		logger.warn('careful');
		logger.error('boom', new Error('details'));
		/* eslint-disable no-console */
		console.log('plain');
		console.table([{ a: 1 }]);
		/* eslint-enable no-console */

		const text = stderr.mock.calls.map((call) => call.map(String).join(' ')).join('\n');
		for (const expected of ['hello', 'careful', 'boom', 'details', 'plain', 'a: 1']) {
			expect(text).toContain(expected);
		}
	});
});
