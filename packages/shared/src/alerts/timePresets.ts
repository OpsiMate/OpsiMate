import { DashboardTimeRange } from '../types';
import { ResolvedTimeWindow } from './alertQuery';

// The alerts time filter's quick presets — the ONE table of labels and window lengths.
// A dashboard stores only the preset name ('last1h', 'today', ...): the window is rolling,
// materialized from "now" whenever the filter runs, so a saved "Last 1 hour" never freezes
// at the moment it was clicked. The browser has always resolved these; the server resolves
// them the same way for anything that reads a dashboard outside the UI.

const minutes = (n: number) => n * 60 * 1000;
const hours = (n: number) => n * 60 * 60 * 1000;
const days = (n: number) => n * 24 * 60 * 60 * 1000;

const presets = [
	{ value: 'last1m', label: 'Last 1 minute', durationMs: minutes(1) },
	{ value: 'last2m', label: 'Last 2 minutes', durationMs: minutes(2) },
	{ value: 'last5m', label: 'Last 5 minutes', durationMs: minutes(5) },
	{ value: 'last15m', label: 'Last 15 minutes', durationMs: minutes(15) },
	{ value: 'last30m', label: 'Last 30 minutes', durationMs: minutes(30) },
	{ value: 'last1h', label: 'Last 1 hour', durationMs: hours(1) },
	{ value: 'last2h', label: 'Last 2 hours', durationMs: hours(2) },
	{ value: 'last6h', label: 'Last 6 hours', durationMs: hours(6) },
	{ value: 'last12h', label: 'Last 12 hours', durationMs: hours(12) },
	{ value: 'last24h', label: 'Last 24 hours', durationMs: hours(24) },
	{ value: 'today', label: 'Today', durationMs: null },
	{ value: 'last2d', label: 'Last 2 days', durationMs: days(2) },
	{ value: 'last3d', label: 'Last 3 days', durationMs: days(3) },
	{ value: 'last5d', label: 'Last 5 days', durationMs: days(5) },
	{ value: 'last7d', label: 'Last 7 days', durationMs: days(7) },
] as const;

export type QuickTimePreset = (typeof presets)[number]['value'];

export interface QuickTimePresetConfig {
	value: QuickTimePreset;
	label: string;
	// Window length ending at "now"; null for 'today', which starts at a calendar
	// boundary (midnight) rather than a fixed distance back.
	durationMs: number | null;
}

export const QUICK_TIME_PRESETS: readonly QuickTimePresetConfig[] = presets;

export const isQuickTimePreset = (value: string | null | undefined): value is QuickTimePreset =>
	presets.some((preset) => preset.value === value);

export const getQuickTimePresetConfig = (preset: QuickTimePreset): QuickTimePresetConfig => {
	const config = QUICK_TIME_PRESETS.find((p) => p.value === preset);
	// Unreachable for typed callers; strings from storage go through isQuickTimePreset first.
	if (!config) throw new Error(`Unknown quick time preset: ${preset}`);
	return config;
};

export interface ResolveTimePresetOptions {
	// The instant the window ends at; defaults to the wall clock.
	now?: Date;
	// IANA zone whose midnight 'today' starts at. Omitted: the process-local zone, which in
	// a browser is the user's — the behaviour the UI has always had. A server resolving a
	// preset on a user's behalf must pass the user's zone, not its own.
	timeZone?: string;
}

export interface QuickPresetWindow {
	from: Date;
	to: Date;
}

interface WallClock {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
}

// One formatter per zone: building one is the expensive part, and a server resolving
// presets on users' behalf asks for the same few zones over and over.
const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
	let formatter = formatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
		formatters.set(timeZone, formatter);
	}
	return formatter;
};

const wallClockIn = (instant: Date, timeZone: string): WallClock => {
	const parts = formatterFor(timeZone).formatToParts(instant);
	const field = (type: Intl.DateTimeFormatPartTypes): number =>
		Number(parts.find((part) => part.type === type)?.value ?? 0);
	return {
		year: field('year'),
		month: field('month'),
		day: field('day'),
		hour: field('hour'),
		minute: field('minute'),
		second: field('second'),
	};
};

// The zone's UTC offset at `instant`, as Intl reports it: the zone's wall clock read as if
// it were UTC, minus the instant itself (sub-second part dropped, Intl has no field for it).
const zoneOffsetMs = (instant: Date, timeZone: string): number => {
	const wall = wallClockIn(instant, timeZone);
	const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
	return asUtc - (instant.getTime() - instant.getMilliseconds());
};

const sameCalendarDay = (a: WallClock, b: WallClock): boolean =>
	a.year === b.year && a.month === b.month && a.day === b.day;

// Midnight of `now`'s calendar day in `timeZone` — the FIRST instant of that day, which is
// what a browser's setHours(0, 0, 0, 0) gives. A DST change on the day itself makes the
// naive "midnight minus the offset at now" wrong, so the offset is read again at the
// candidate and just before it, and the earliest instant that still reads as 00:00 of the
// day wins (Cuba repeats 00:00–01:00 when it falls back; the first one is the day's start).
// A day with no 00:00 at all (a zone that springs forward at midnight) starts at the
// earliest instant that reads as that day.
const startOfDayIn = (now: Date, timeZone: string): Date => {
	const wall = wallClockIn(now, timeZone);
	const midnightAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day);
	const first = new Date(midnightAsUtc - zoneOffsetMs(now, timeZone));
	const second = new Date(midnightAsUtc - zoneOffsetMs(first, timeZone));
	const probes = [first, second, new Date(second.getTime() - 1), new Date(first.getTime() - 1)];
	const candidates = probes
		.map((probe) => new Date(midnightAsUtc - zoneOffsetMs(probe, timeZone)))
		.sort((a, b) => a.getTime() - b.getTime());
	const exact = candidates.find((candidate) => {
		const at = wallClockIn(candidate, timeZone);
		return sameCalendarDay(at, wall) && at.hour === 0 && at.minute === 0 && at.second === 0;
	});
	if (exact) return exact;
	const onTheDay = candidates.find((candidate) => sameCalendarDay(wallClockIn(candidate, timeZone), wall));
	return onTheDay ?? second;
};

const startOfDay = (now: Date, timeZone: string | undefined): Date => {
	if (timeZone) return startOfDayIn(now, timeZone);
	const local = new Date(now);
	local.setHours(0, 0, 0, 0);
	return local;
};

// The concrete window a preset means right now. Throws a RangeError for a `timeZone` the
// runtime does not know — validate user-supplied zones before calling.
export const resolveQuickPreset = (
	preset: QuickTimePreset,
	options: ResolveTimePresetOptions = {}
): QuickPresetWindow => {
	const now = options.now ?? new Date();
	const { durationMs } = getQuickTimePresetConfig(preset);
	// Fresh Date instances: a caller that adjusts the window must not move its own clock.
	if (durationMs === null) return { from: startOfDay(now, options.timeZone), to: new Date(now) };
	return { from: new Date(now.getTime() - durationMs), to: new Date(now) };
};

// A stored dashboard time range as the alerts query engine wants it. Quick presets are
// materialized from "now"; 'custom' (and any preset this build does not know) keeps the
// absolute dates that were saved with it, which may be none at all.
export const resolveDashboardTimeRange = (
	range: DashboardTimeRange | null | undefined,
	options: ResolveTimePresetOptions = {}
): ResolvedTimeWindow => {
	if (!range) return { from: null, to: null };
	if (isQuickTimePreset(range.preset)) {
		const { from, to } = resolveQuickPreset(range.preset, options);
		return { from: from.toISOString(), to: to.toISOString() };
	}
	return { from: range.from ?? null, to: range.to ?? null };
};
