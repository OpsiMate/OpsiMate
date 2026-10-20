import { ResolvedTimeWindow } from '@OpsiMate/shared';

// Time windows as the tools take them, turned into the concrete [from, to] the alerts
// query engine wants.

export interface TimeWindowArgs {
	from?: string;
	to?: string;
	lastMinutes?: number;
}

export interface ResolvedWindowOk {
	ok: true;
	window: ResolvedTimeWindow;
}

export interface ResolvedWindowError {
	ok: false;
	message: string;
}

export type WindowResolution = ResolvedWindowOk | ResolvedWindowError;

const MINUTE_MS = 60_000;
const floorMinute = (date: Date): Date => new Date(Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS);
const ceilMinute = (date: Date): Date => new Date(Math.ceil(date.getTime() / MINUTE_MS) * MINUTE_MS);

// A rolling window re-anchors to "now" on every call, which would mint a new query-cache
// key per call. Rounded OUTWARD to the minute (the client does the same, see Alerts.tsx
// toCoarseWindow) the key stays put for a minute at a time while the window remains a
// superset of what was asked — at most 59 seconds wider on either side.
export const toCoarseWindow = (from: Date | null, to: Date | null): ResolvedTimeWindow => ({
	from: from ? floorMinute(from).toISOString() : null,
	to: to ? ceilMinute(to).toISOString() : null,
});

// `from`/`to` are taken as given (an explicit timestamp is already a stable key);
// `lastMinutes` becomes a coarse rolling window. Both at once is a contradiction the
// caller must resolve.
export const resolveWindowArgs = (args: TimeWindowArgs, now: Date = new Date()): WindowResolution => {
	if (args.lastMinutes !== undefined) {
		if (args.from !== undefined || args.to !== undefined) {
			return { ok: false, message: 'Give either lastMinutes or from/to, not both.' };
		}
		return { ok: true, window: toCoarseWindow(new Date(now.getTime() - args.lastMinutes * MINUTE_MS), now) };
	}
	if (args.from !== undefined && args.to !== undefined && Date.parse(args.from) > Date.parse(args.to)) {
		return { ok: false, message: `from (${args.from}) is after to (${args.to}).` };
	}
	return { ok: true, window: { from: args.from ?? null, to: args.to ?? null } };
};

// The schema promises "Default: UTC" for every timeZone input, so every call into the
// shared resolvers (whose own default is the process-local zone) goes through this: a
// "today" dashboard read from a server in Jerusalem starts at UTC midnight, as documented.
export const DEFAULT_TIME_ZONE = 'UTC';
export const effectiveTimeZone = (timeZone: string | undefined): string => timeZone?.trim() || DEFAULT_TIME_ZONE;

// The problem with a caller-supplied IANA zone, or null when the runtime knows it.
// resolveQuickPreset throws a RangeError on an unknown zone, so this runs first.
export const timeZoneProblem = (timeZone: string | undefined): string | null => {
	if (timeZone === undefined) return null;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone });
		return null;
	} catch {
		return `Unknown time zone "${timeZone}". Use an IANA zone name such as "UTC", "Europe/London" or "Asia/Jerusalem".`;
	}
};
