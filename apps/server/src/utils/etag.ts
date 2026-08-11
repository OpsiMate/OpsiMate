// If-None-Match evaluation per RFC 7232 §3.2. An exact-string compare against our own
// ETag is not enough in deployment: the header may carry a list, a client may echo a
// weak validator — reverse proxies like nginx downgrade ETags to W/"..." when they
// re-compress a response — and `*` matches any current representation. Weak comparison
// (prefix-insensitive) is the specified rule for If-None-Match.
export const ifNoneMatchSatisfied = (header: string | string[] | undefined, etag: string): boolean => {
	if (!header) return false;
	const value = Array.isArray(header) ? header.join(',') : header;
	if (value.trim() === '*') return true;
	const opaque = (tag: string) => tag.trim().replace(/^W\//i, '');
	const target = opaque(etag);
	return value.split(',').some((candidate) => opaque(candidate) === target);
};
