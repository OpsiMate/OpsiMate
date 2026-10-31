import { describe, expect, test } from 'vitest';
import { LoginThrottle } from '../src/bl/users/loginThrottle';

interface FakeClock {
	now: () => number;
	advance: (ms: number) => void;
}

const fakeClock = (): FakeClock => {
	let t = 1_000_000;
	return { now: () => t, advance: (ms) => (t += ms) };
};

describe('LoginThrottle', () => {
	test('throttles a key after maxFailures in the window, then forgets after it', () => {
		const clock = fakeClock();
		const throttle = new LoginThrottle({ maxFailures: 3, windowMs: 1000, buckets: 1024, now: clock.now });
		for (let i = 0; i < 2; i++) throttle.recordFailure('a@x');
		expect(throttle.isThrottled('a@x')).toBe(false);
		throttle.recordFailure('a@x');
		expect(throttle.isThrottled('a@x')).toBe(true);
		clock.advance(1001);
		expect(throttle.isThrottled('a@x')).toBe(false);
	});

	test('flooding with other keys never resets or stops tracking a victim (no cap to overflow)', () => {
		const throttle = new LoginThrottle({ maxFailures: 5, windowMs: 60_000, buckets: 1024 });
		for (let i = 0; i < 5; i++) throttle.recordFailure('victim@x');
		for (let i = 0; i < 50_000; i++) throttle.recordFailure(`spray${i}@x`);
		expect(throttle.isThrottled('victim@x')).toBe(true);
	});

	test('a success resets the key', () => {
		const throttle = new LoginThrottle({ maxFailures: 2, windowMs: 60_000, buckets: 1024 });
		throttle.recordFailure('a@x');
		throttle.recordFailure('a@x');
		throttle.reset('a@x');
		expect(throttle.isThrottled('a@x')).toBe(false);
	});

	test('bucket count must be a power of two', () => {
		expect(() => new LoginThrottle({ maxFailures: 1, windowMs: 1, buckets: 1000 })).toThrow();
	});
});
