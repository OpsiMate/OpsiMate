// Every timestamp the app renders goes through here, so the clock stays 24-hour
// everywhere — alert columns, history, on-call, mute policies, audit log.
//
// The clock is pinned with hourCycle 'h23' rather than hour12: false. They look
// interchangeable but are not: hour12: false resolves to an h24 cycle in some locales,
// which renders midnight as 24:00 instead of 00:00.
//
// Locale is left to the viewer (undefined), so the date half keeps their own ordering
// and month names; only the clock is fixed.

const HOUR_CYCLE = 'h23' as const;

const TIME: Intl.DateTimeFormatOptions = {
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: HOUR_CYCLE,
};

const TIME_WITH_SECONDS: Intl.DateTimeFormatOptions = { ...TIME, second: '2-digit' };

// "Aug 11, 22:53" — the compact form for badges and table-adjacent copy.
const SHORT_DATE_TIME: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', ...TIME };

// "Aug 11, 2026, 22:53" — same, with the year, where the row may be months old.
const LONG_DATE_TIME: Intl.DateTimeFormatOptions = {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	...TIME,
};

// "08/11/2026, 22:53:07" — the unambiguous form for tooltips and copied values.
const NUMERIC_DATE_TIME: Intl.DateTimeFormatOptions = {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	...TIME_WITH_SECONDS,
};

export type DateInput = string | number | Date | null | undefined;

const toDate = (value: DateInput): Date | null => {
	if (value === null || value === undefined || value === '') return null;
	const date = value instanceof Date ? value : new Date(value);
	return isNaN(date.getTime()) ? null : date;
};

// One formatter per options shape, built lazily: toLocaleString constructs a new
// Intl.DateTimeFormat on EVERY call, and that construction — not the formatting —
// is the dominant cost. Tables format hundreds of cells per render, so the reuse
// is the difference between formatting being free and being a profiler hotspot.
// All options objects reaching format() are the module constants above, so keying
// the cache by object identity is exact and its size is bounded by their count.
const formatterCache = new Map<Intl.DateTimeFormatOptions, Intl.DateTimeFormat>();

const format = (value: DateInput, options: Intl.DateTimeFormatOptions, fallback: string): string => {
	const date = toDate(value);
	if (!date) return fallback;
	let formatter = formatterCache.get(options);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(undefined, options);
		formatterCache.set(options, formatter);
	}
	return formatter.format(date);
};

/** "22:53:07" — time only, for rows already scoped to today. */
export const formatTime = (value: DateInput, fallback = '—'): string => format(value, TIME_WITH_SECONDS, fallback);

/** "Aug 11, 22:53" */
export const formatShortDateTime = (value: DateInput, fallback = '—'): string =>
	format(value, SHORT_DATE_TIME, fallback);

/** "Aug 11, 2026, 22:53" */
export const formatLongDateTime = (value: DateInput, fallback = '—'): string => format(value, LONG_DATE_TIME, fallback);

/** "08/11/2026, 22:53:07" — full precision, for tooltips and copy-to-clipboard. */
export const formatDateTime = (value: DateInput, fallback = '—'): string => format(value, NUMERIC_DATE_TIME, fallback);

/** True when the timestamp falls on the viewer's current calendar day. */
export const isSameLocalDay = (value: DateInput, reference: Date = new Date()): boolean => {
	const date = toDate(value);
	if (!date) return false;
	return (
		date.getFullYear() === reference.getFullYear() &&
		date.getMonth() === reference.getMonth() &&
		date.getDate() === reference.getDate()
	);
};
