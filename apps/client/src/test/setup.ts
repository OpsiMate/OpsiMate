import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { Logger } from '@OpsiMate/shared';
import { afterEach, vi } from 'vitest';

const logger = new Logger('test/setup');

Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Tests render components that fire real requests; those 401 and send lib/api down its
// session-expired path, which assigns window.location.href. jsdom implements no navigation,
// so each assignment emits "Not implemented: navigation to another Document" on its virtual
// console — and a burst of those can still be in flight when the worker tears down, which
// vitest reports as an EnvironmentTeardownError that fails an otherwise-green run.
// Swapping in a plain stub keeps every field the app reads while making assignment inert.
//
// Guarded on the descriptor because location is only replaceable here by grace of how
// vitest builds its jsdom globals — the spec marks it unforgeable, and raw jsdom (and
// jsdom under jest) makes it non-configurable, where defineProperty throws. Should vitest
// ever match that, the warning points at the cause instead of every test file failing on
// a TypeError raised from setup.
const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
if (locationDescriptor?.configurable) {
	const { protocol, hostname, port, host, origin, pathname, search, hash, href } = window.location;
	Object.defineProperty(window, 'location', {
		configurable: true,
		writable: true,
		value: {
			protocol,
			hostname,
			port,
			host,
			origin,
			pathname,
			search,
			hash,
			href,
			assign: vi.fn(),
			replace: vi.fn(),
			reload: vi.fn(),
			// Reads the live property: href is writable, and a closure over the initial
			// value would return a stale URL after a test assigns location.href.
			toString(this: { href: string }) {
				return this.href;
			},
		},
	});
} else {
	logger.warn(
		'window.location is non-configurable; navigation stub skipped. ' +
			'Expect "Not implemented: navigation" noise and possible teardown flakes.'
	);
}

afterEach(() => {
	cleanup();
});
