// Alert timestamps the way the alerts table shows them, for action templates. The table
// prints today's rows as a bare clock ("17:15:53") and older ones with the date
// ("10/20/2026, 17:15:53"), in the viewer's time zone and locale, 24-hour clock. An
// action sent from that table should say the same thing — {{startsAt}} stays the exact
// ISO instant for machines, {{startsAt.display}} is what the person was looking at.

export interface ViewerFormatting {
	// IANA zone of the person triggering the action, e.g. "Asia/Jerusalem"; the server's
	// own zone when absent (automatic runs have no viewer).
	timeZone?: string | null;
	// BCP 47 tag, e.g. "en-US"; the runtime default when absent.
	locale?: string | null;
}

const HOUR_CYCLE = 'h23' as const;
const TIME_WITH_SECONDS: Intl.DateTimeFormatOptions = {
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: HOUR_CYCLE,
};
const NUMERIC_DATE_TIME: Intl.DateTimeFormatOptions = {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	...TIME_WITH_SECONDS,
};
const DAY_KEY: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };

const toDate = (value: string | number | Date | null | undefined): Date | null => {
	if (value === null || value === undefined || value === '') return null;
	const date = value instanceof Date ? value : new Date(value);
	return isNaN(date.getTime()) ? null : date;
};

// Constructing an Intl.DateTimeFormat is the expensive part of Intl (~40 µs), not
// formatting with it (<1 µs). Enrichment templates resolve for EVERY alert when a list is
// built, and each alert context formats three timestamps with three formatters — uncached,
// a few thousand alerts cost seconds per list. Keyed by locale, zone and option set; the
// option sets are the module constants above, so the cache stays a handful of entries per
// distinct viewer. Bounded so a flood of garbage zones from a client cannot grow it.
const formatterCache = new Map<string, Intl.DateTimeFormat>();
const FORMATTER_CACHE_MAX = 500;

const formatter = (options: Intl.DateTimeFormatOptions, viewer: ViewerFormatting | undefined): Intl.DateTimeFormat => {
	const timeZone = viewer?.timeZone?.trim() || undefined;
	const locale = viewer?.locale?.trim() || undefined;
	const key = `${locale ?? ''}|${timeZone ?? ''}|${options === NUMERIC_DATE_TIME ? 'full' : options === DAY_KEY ? 'day' : 'time'}`;
	const cached = formatterCache.get(key);
	if (cached) return cached;
	const built = buildFormatter(options, locale, timeZone);
	if (formatterCache.size >= FORMATTER_CACHE_MAX) formatterCache.clear();
	formatterCache.set(key, built);
	return built;
};

// A formatter for the viewer, or for the runtime's defaults when their zone or locale is
// not one Intl knows (a typo in a header must not fail an action).
const buildFormatter = (
	options: Intl.DateTimeFormatOptions,
	locale: string | undefined,
	timeZone: string | undefined
): Intl.DateTimeFormat => {
	try {
		return new Intl.DateTimeFormat(locale, { ...options, timeZone });
	} catch {
		// Drop one of the two at a time: an unknown zone should not also cost the locale.
		try {
			return new Intl.DateTimeFormat(locale, options);
		} catch {
			try {
				return new Intl.DateTimeFormat(undefined, { ...options, timeZone });
			} catch {
				return new Intl.DateTimeFormat(undefined, options);
			}
		}
	}
};

// "10/20/2026, 17:15:53" — the unambiguous form the table shows on hover and copies.
export const formatAlertTimestampFull = (value: string | null | undefined, viewer?: ViewerFormatting): string => {
	const date = toDate(value);
	return date ? formatter(NUMERIC_DATE_TIME, viewer).format(date) : '';
};

// What the table cell shows: the clock alone when the timestamp falls on the viewer's
// current calendar day, the full form otherwise.
export const formatAlertTimestampDisplay = (
	value: string | null | undefined,
	viewer?: ViewerFormatting,
	now: Date = new Date()
): string => {
	const date = toDate(value);
	if (!date) return '';
	const dayOf = formatter(DAY_KEY, viewer);
	const sameDay = dayOf.format(date) === dayOf.format(now);
	return sameDay
		? formatter(TIME_WITH_SECONDS, viewer).format(date)
		: formatter(NUMERIC_DATE_TIME, viewer).format(date);
};
