import crypto from 'node:crypto';

export interface LoginThrottleOptions {
	maxFailures: number;
	windowMs: number;
	// Power of two. Memory is fixed: two numbers per bucket.
	buckets: number;
	now?: () => number;
}

// Failed-login counter per key (a normalized email) in a fixed window, kept in a
// fixed number of buckets instead of a growing map: nothing is ever evicted, so
// flooding it with other keys cannot reset or stop tracking a victim's counter.
// Keys are hashed with a per-process secret, so collisions can't be aimed; a chance
// collision only throttles an innocent key for the rest of the window (fail-safe).
export class LoginThrottle {
	private readonly counts: Uint32Array;
	private readonly windowStarts: Float64Array;
	private readonly secret = crypto.randomBytes(32);
	private readonly now: () => number;

	constructor(private readonly options: LoginThrottleOptions) {
		if (options.buckets <= 0 || (options.buckets & (options.buckets - 1)) !== 0) {
			throw new Error('LoginThrottle buckets must be a power of two');
		}
		this.counts = new Uint32Array(options.buckets);
		this.windowStarts = new Float64Array(options.buckets);
		this.now = options.now ?? Date.now;
	}

	isThrottled(key: string): boolean {
		const bucket = this.bucketOf(key);
		if (this.expired(bucket)) return false;
		return this.counts[bucket] >= this.options.maxFailures;
	}

	// Returns the failure count for the key's bucket after recording this one.
	recordFailure(key: string): number {
		const bucket = this.bucketOf(key);
		if (this.expired(bucket)) {
			this.counts[bucket] = 0;
			this.windowStarts[bucket] = this.now();
		}
		if (this.counts[bucket] < 0xffffffff) this.counts[bucket]++;
		return this.counts[bucket];
	}

	// A success clears the key's bucket (shared only on a chance collision).
	reset(key: string): void {
		this.counts[this.bucketOf(key)] = 0;
	}

	private expired(bucket: number): boolean {
		return this.now() - this.windowStarts[bucket] > this.options.windowMs;
	}

	private bucketOf(key: string): number {
		const digest = crypto.createHmac('sha256', this.secret).update(key).digest();
		return digest.readUInt32BE(0) & (this.options.buckets - 1);
	}
}
