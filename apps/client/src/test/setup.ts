import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

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
		toString: () => href,
	},
});

afterEach(() => {
	cleanup();
});
