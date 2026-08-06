// Normalizes a timestamp to ISO-8601 UTC. SQLite CURRENT_TIMESTAMP values are
// "YYYY-MM-DD HH:MM:SS" (UTC, but without a timezone marker) — a client's
// `new Date(...)` would parse that as LOCAL time and shift the display by the
// viewer's UTC offset. Already-ISO values pass through unchanged (modulo
// canonical formatting); unparseable values are returned as-is.
export const toIsoUtc = (value: string): string => {
	if (!value) return value;
	const d = value.includes('T') ? new Date(value) : new Date(value.replace(' ', 'T') + 'Z');
	return isNaN(d.getTime()) ? value : d.toISOString();
};
