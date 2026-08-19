import {
	Alert,
	AlertAnalytics,
	TagInsights,
	TagValueDayPoint,
	TagValueStats,
	AlertNameStats,
	AnalyticsKpi,
	DayVolumePoint,
	DurationStats,
	HourVolumePoint,
	NamedCount,
	SeveritySlice,
} from '@OpsiMate/shared';

// One row of alerts_history, normalized to ISO. 'firing' rows carry the episode's
// starts_at; 'resolved' rows carry the resolution moment.
export interface EpisodeRow {
	alertId: string;
	status: string;
	at: string;
}

// One user action (own/silence/comment/action-run/resolve...) on an alert.
export interface UserEventRow {
	alertId: string;
	at: string;
	// Who did it; null for system-recorded events. Feeds the Top responders list.
	actorName?: string | null;
}

export interface AnalyticsInputs {
	episodes: EpisodeRow[];
	events: UserEventRow[];
	activeAlerts: Alert[];
	resolvedAlerts: Alert[];
	// ISO bounds; from=null means All time. `to` is "now" as the caller sees it.
	from: string | null;
	to: string;
	// IANA timezone for day/hour bucketing — peak hours must be the USER's hours.
	timeZone?: string;
	// When present (a dashboard's filters are active), only these alerts' episodes
	// count. Alerts deleted from both tables can never match a filter, so they are
	// naturally excluded.
	allowedAlertIds?: Set<string>;
	// Tag key to research; adds the tagInsights section to the result.
	tagKey?: string;
}

// A reconstructed firing episode: started, maybe resolved, maybe first-touched.
interface Episode {
	alertId: string;
	startMs: number;
	// Resolution moment, if a 'resolved' row followed before the next firing.
	resolvedMs: number | null;
	// First human action between start and resolution (or next firing).
	firstTouchMs: number | null;
}

interface AlertMeta {
	name: string;
	severity: string | null;
	tags: Record<string, string>;
}

// "The fix didn't hold": a resolution followed by the same alert re-firing within
// this window counts as a failed resolution (change-failure-rate's alert analog).
const REFIRE_WINDOW_MS = 24 * 60 * 60 * 1000;
const TOP_NAMES = 10;
const TOP_TAGS = 12;

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 };

const percentile = (sorted: number[], p: number): number | null => {
	if (sorted.length === 0) return null;
	const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
	return sorted[Math.max(0, index)];
};

const durationStats = (samples: number[]): DurationStats => {
	if (samples.length === 0) return { meanMs: null, medianMs: null, p90Ms: null, count: 0 };
	const sorted = [...samples].sort((a, b) => a - b);
	const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
	return {
		meanMs: Math.round(mean),
		medianMs: percentile(sorted, 50),
		p90Ms: percentile(sorted, 90),
		count: sorted.length,
	};
};

const kpi = (value: number, previous: number | null): AnalyticsKpi => ({ value, previous });

// Rebuilds each alert's episode list from its history rows. Rows are paired in time
// order: a firing opens an episode; the first resolution before the next firing
// closes it. User events attach to the episode they fall inside.
const buildEpisodes = (rows: EpisodeRow[], events: UserEventRow[]): Episode[] => {
	const rowsByAlert = new Map<string, EpisodeRow[]>();
	for (const row of rows) {
		const list = rowsByAlert.get(row.alertId);
		if (list) list.push(row);
		else rowsByAlert.set(row.alertId, [row]);
	}
	const eventsByAlert = new Map<string, number[]>();
	for (const event of events) {
		const ms = Date.parse(event.at);
		if (Number.isNaN(ms)) continue;
		const list = eventsByAlert.get(event.alertId);
		if (list) list.push(ms);
		else eventsByAlert.set(event.alertId, [ms]);
	}

	const episodes: Episode[] = [];
	for (const [alertId, alertRows] of rowsByAlert) {
		const timeline = alertRows
			.map((row) => ({ status: row.status, ms: Date.parse(row.at) }))
			.filter((row) => !Number.isNaN(row.ms))
			.sort((a, b) => a.ms - b.ms);
		const alertEvents = (eventsByAlert.get(alertId) ?? []).sort((a, b) => a - b);

		const alertEpisodes: Episode[] = [];
		let open: Episode | null = null;
		for (const row of timeline) {
			if (row.status === 'firing') {
				// A new firing always starts a new episode; an unclosed previous one
				// (unresolve, or the resolved row was purged) just ends unresolved.
				if (open) alertEpisodes.push(open);
				open = { alertId, startMs: row.ms, resolvedMs: null, firstTouchMs: null };
			} else if (row.status === 'resolved' && open && open.resolvedMs === null && row.ms >= open.startMs) {
				open.resolvedMs = row.ms;
			}
		}
		if (open) alertEpisodes.push(open);

		// Attach the first human touch inside each episode. The span is bounded by the
		// resolution OR the next episode's start — an unresolved episode must not
		// swallow events that belong to the one after it. Events and episodes are both
		// time-sorted, so one forward cursor keeps this linear.
		let eventCursor = 0;
		for (let i = 0; i < alertEpisodes.length; i++) {
			const episode = alertEpisodes[i];
			const nextStart = i + 1 < alertEpisodes.length ? alertEpisodes[i + 1].startMs : Number.POSITIVE_INFINITY;
			const spanEnd = Math.min(episode.resolvedMs ?? Number.POSITIVE_INFINITY, nextStart);
			while (eventCursor < alertEvents.length && alertEvents[eventCursor] < episode.startMs) eventCursor++;
			if (eventCursor < alertEvents.length && alertEvents[eventCursor] <= spanEnd) {
				episode.firstTouchMs = alertEvents[eventCursor];
			}
		}
		episodes.push(...alertEpisodes);
	}
	return episodes;
};

// Day (YYYY-MM-DD) and hour-of-day in the requester's timezone. Cached formatter —
// building Intl.DateTimeFormat per timestamp is 100x the cost of formatting.
const makeLocalParts = (timeZone: string | undefined) => {
	let dayFormat: Intl.DateTimeFormat;
	let hourFormat: Intl.DateTimeFormat;
	try {
		dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' });
		hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' });
	} catch {
		// Unknown timezone from the client falls back to the server's.
		dayFormat = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short' });
		hourFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23' });
	}
	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	let weekdayFormat: Intl.DateTimeFormat;
	try {
		weekdayFormat = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
	} catch {
		weekdayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
	}
	return {
		day: (ms: number): string => dayFormat.format(ms),
		hour: (ms: number): number => parseInt(hourFormat.format(ms), 10),
		weekday: (ms: number): number => Math.max(0, WEEKDAYS.indexOf(weekdayFormat.format(ms))),
	};
};

export const computeAlertAnalytics = (inputs: AnalyticsInputs): AlertAnalytics => {
	const toMs = Date.parse(inputs.to);
	const fromMs = inputs.from ? Date.parse(inputs.from) : null;
	// Previous window: same length, immediately before. All time has no "previous".
	const previousFromMs = fromMs !== null ? fromMs - (toMs - fromMs) : null;

	const inWindow = (ms: number): boolean => ms <= toMs && (fromMs === null || ms >= fromMs);
	const inPreviousWindow = (ms: number): boolean =>
		previousFromMs !== null && fromMs !== null && ms >= previousFromMs && ms < fromMs;

	const meta = new Map<string, AlertMeta>();
	for (const alert of [...inputs.resolvedAlerts, ...inputs.activeAlerts]) {
		meta.set(alert.id, {
			name: alert.alertName,
			severity: alert.severity ?? null,
			tags: alert.tags ?? {},
		});
	}

	const allowed = inputs.allowedAlertIds;
	const isAllowed = (alertId: string): boolean => !allowed || allowed.has(alertId);

	const episodes = buildEpisodes(inputs.episodes, inputs.events).filter((e) => isAllowed(e.alertId));
	const windowEpisodes = episodes.filter((e) => inWindow(e.startMs));
	const previousEpisodes = episodes.filter((e) => inPreviousWindow(e.startMs));

	// ---- overview -------------------------------------------------------------
	const local = makeLocalParts(inputs.timeZone);

	const dayPoints = new Map<string, DayVolumePoint>();
	const hourCounts = new Array<number>(24).fill(0);
	const weekdayCounts = new Array<number>(7).fill(0);
	const severityCounts = new Map<string, number>();
	const nameCounts = new Map<string, number>();
	for (const episode of windowEpisodes) {
		const m = meta.get(episode.alertId);
		const severity = m?.severity ?? 'warning';
		const day = local.day(episode.startMs);
		let point = dayPoints.get(day);
		if (!point) {
			point = { date: day, critical: 0, warning: 0, info: 0, total: 0, resolved: 0 };
			dayPoints.set(day, point);
		}
		if (severity === 'critical') point.critical += 1;
		else if (severity === 'info') point.info += 1;
		else point.warning += 1;
		point.total += 1;
		hourCounts[local.hour(episode.startMs)] += 1;
		weekdayCounts[local.weekday(episode.startMs)] += 1;
		severityCounts.set(severity, (severityCounts.get(severity) ?? 0) + 1);
		if (m) nameCounts.set(m.name, (nameCounts.get(m.name) ?? 0) + 1);
	}

	const tagCounts = new Map<string, number>();
	const tagKeySet = new Set<string>();
	const alertIdsInWindow = new Set(windowEpisodes.map((e) => e.alertId));
	for (const alertId of alertIdsInWindow) {
		const m = meta.get(alertId);
		if (!m) continue;
		for (const [key, value] of Object.entries(m.tags)) {
			tagKeySet.add(key);
			const pair = `${key}=${value}`;
			tagCounts.set(pair, (tagCounts.get(pair) ?? 0) + 1);
		}
	}

	const topOf = (counts: Map<string, number>, limit: number): NamedCount[] =>
		[...counts.entries()]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
			.slice(0, limit);

	const activeAllowed = inputs.activeAlerts.filter((a) => isAllowed(a.id));
	const silencedNow = activeAllowed.filter((a) => a.isSilenced || a.isMuted).length;
	const resolutionsInRange = episodes.filter((e) => e.resolvedMs !== null && inWindow(e.resolvedMs));

	// Resolutions overlay + per-day MTTR trend, bucketed by the local day the
	// resolution LANDED on (that is when the work happened).
	const mttrDayAcc = new Map<string, { total: number; count: number }>();
	for (const episode of resolutionsInRange) {
		const resolvedMs = episode.resolvedMs as number;
		const day = local.day(resolvedMs);
		let point = dayPoints.get(day);
		if (!point) {
			point = { date: day, critical: 0, warning: 0, info: 0, total: 0, resolved: 0 };
			dayPoints.set(day, point);
		}
		point.resolved += 1;
		const acc = mttrDayAcc.get(day);
		const duration = resolvedMs - episode.startMs;
		if (acc) {
			acc.total += duration;
			acc.count += 1;
		} else {
			mttrDayAcc.set(day, { total: duration, count: 1 });
		}
	}

	// Top responders: user actions in the window, counted by actor. Only episodes'
	// alerts count when a filter is active — the list must match the scope.
	const responderCounts = new Map<string, number>();
	for (const event of inputs.events) {
		if (!event.actorName) continue;
		if (!isAllowed(event.alertId)) continue;
		const ms = Date.parse(event.at);
		if (Number.isNaN(ms) || !inWindow(ms)) continue;
		responderCounts.set(event.actorName, (responderCounts.get(event.actorName) ?? 0) + 1);
	}
	const previousResolutions = episodes.filter((e) => e.resolvedMs !== null && inPreviousWindow(e.resolvedMs)).length;

	const severitySlices: SeveritySlice[] = [...severityCounts.entries()]
		.map(([severity, count]) => ({ severity, count }))
		.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));

	// ---- reliability ----------------------------------------------------------
	const mttrSamples = resolutionsInRange.map((e) => (e.resolvedMs as number) - e.startMs);
	const previousMttrSamples = episodes
		.filter((e) => e.resolvedMs !== null && inPreviousWindow(e.resolvedMs))
		.map((e) => (e.resolvedMs as number) - e.startMs);
	const previousMeanMs =
		previousMttrSamples.length > 0
			? Math.round(previousMttrSamples.reduce((sum, v) => sum + v, 0) / previousMttrSamples.length)
			: null;

	const mttaSamples = windowEpisodes
		.filter((e) => e.firstTouchMs !== null)
		.map((e) => (e.firstTouchMs as number) - e.startMs);

	// MTBF: gaps between consecutive firing starts of the same alert, where the LATER
	// start is in the window.
	const startsByAlert = new Map<string, number[]>();
	for (const episode of episodes) {
		const list = startsByAlert.get(episode.alertId);
		if (list) list.push(episode.startMs);
		else startsByAlert.set(episode.alertId, [episode.startMs]);
	}
	const mtbfSamples: number[] = [];
	let alertsMeasured = 0;
	for (const starts of startsByAlert.values()) {
		starts.sort((a, b) => a - b);
		let measured = false;
		for (let i = 1; i < starts.length; i++) {
			if (inWindow(starts[i])) {
				mtbfSamples.push(starts[i] - starts[i - 1]);
				measured = true;
			}
		}
		if (measured) alertsMeasured += 1;
	}
	const mtbfMean =
		mtbfSamples.length > 0 ? Math.round(mtbfSamples.reduce((sum, v) => sum + v, 0) / mtbfSamples.length) : null;

	// Re-fire rate over resolutions in the window: did the same alert fire again
	// within 24h of this resolution?
	let refired = 0;
	for (const resolution of resolutionsInRange) {
		const resolvedMs = resolution.resolvedMs as number;
		const starts = startsByAlert.get(resolution.alertId) ?? [];
		if (starts.some((s) => s > resolvedMs && s - resolvedMs <= REFIRE_WINDOW_MS)) refired += 1;
	}

	const acked = windowEpisodes.filter((e) => e.firstTouchMs !== null).length;

	const windowDays = fromMs !== null ? Math.max(1, (toMs - fromMs) / (24 * 60 * 60 * 1000)) : null;
	const episodesPerDay = kpi(
		windowDays !== null ? Number((windowEpisodes.length / windowDays).toFixed(2)) : windowEpisodes.length,
		windowDays !== null ? Number((previousEpisodes.length / windowDays).toFixed(2)) : null
	);

	// ---- per-name table -------------------------------------------------------
	// Grouped by alert NAME (several source ids can share one name); each row rolls
	// up its ids' episodes so a renamed/duplicated alert reads as one line.
	const firingNowIds = new Set(inputs.activeAlerts.map((a) => a.id));
	interface NameAccumulator {
		episodes: Episode[];
		alertIds: Set<string>;
	}
	const byNameAcc = new Map<string, NameAccumulator>();
	for (const episode of windowEpisodes) {
		const m = meta.get(episode.alertId);
		if (!m) continue;
		let acc = byNameAcc.get(m.name);
		if (!acc) {
			acc = { episodes: [], alertIds: new Set() };
			byNameAcc.set(m.name, acc);
		}
		acc.episodes.push(episode);
		acc.alertIds.add(episode.alertId);
	}
	const byName: AlertNameStats[] = [...byNameAcc.entries()].map(([name, acc]) => {
		const resolved = acc.episodes.filter((e) => e.resolvedMs !== null);
		const mttr = durationStats(resolved.map((e) => (e.resolvedMs as number) - e.startMs));
		const gaps: number[] = [];
		for (const alertId of acc.alertIds) {
			const starts = (startsByAlert.get(alertId) ?? []).filter((s) => inWindow(s)).sort((a, b) => a - b);
			for (let i = 1; i < starts.length; i++) gaps.push(starts[i] - starts[i - 1]);
		}
		let nameRefired = 0;
		for (const e of resolved) {
			const starts = startsByAlert.get(e.alertId) ?? [];
			if (starts.some((s) => s > (e.resolvedMs as number) && s - (e.resolvedMs as number) <= REFIRE_WINDOW_MS))
				nameRefired += 1;
		}
		let worst: string | null = null;
		for (const alertId of acc.alertIds) {
			const severity = meta.get(alertId)?.severity ?? null;
			if (severity && (worst === null || (SEVERITY_RANK[severity] ?? 9) < (SEVERITY_RANK[worst] ?? 9)))
				worst = severity;
		}
		return {
			name,
			episodes: acc.episodes.length,
			firingNow: [...acc.alertIds].filter((id) => firingNowIds.has(id)).length,
			mttrMs: mttr.meanMs,
			mtbfMs: gaps.length > 0 ? Math.round(gaps.reduce((sum, v) => sum + v, 0) / gaps.length) : null,
			refireRate: resolved.length > 0 ? Number((nameRefired / resolved.length).toFixed(3)) : null,
			worstSeverity: worst,
			// reduce, not Math.max(...spread): a name with tens of thousands of episodes
			// would blow the argument-count limit and throw a RangeError.
			lastSeen: new Date(acc.episodes.reduce((max, e) => Math.max(max, e.startMs), 0)).toISOString(),
		};
	});
	byName.sort((a, b) => b.episodes - a.episodes || a.name.localeCompare(b.name));

	// ---- tag research -----------------------------------------------------------
	// Everything about one tag key: per-value stats and a top-values volume split.
	let tagInsights: TagInsights | undefined;
	if (inputs.tagKey) {
		const key = inputs.tagKey;
		interface TagValueAccumulator {
			episodes: number;
			resolvedDurations: number[];
			alertIds: Set<string>;
			dayCounts: Map<string, number>;
		}
		const byValue = new Map<string, TagValueAccumulator>();
		let taggedEpisodes = 0;
		let untaggedEpisodes = 0;
		for (const episode of windowEpisodes) {
			const value = meta.get(episode.alertId)?.tags[key];
			if (value === undefined) {
				untaggedEpisodes += 1;
				continue;
			}
			taggedEpisodes += 1;
			let acc = byValue.get(value);
			if (!acc) {
				acc = { episodes: 0, resolvedDurations: [], alertIds: new Set(), dayCounts: new Map() };
				byValue.set(value, acc);
			}
			acc.episodes += 1;
			acc.alertIds.add(episode.alertId);
			if (episode.resolvedMs !== null) acc.resolvedDurations.push(episode.resolvedMs - episode.startMs);
			const day = local.day(episode.startMs);
			acc.dayCounts.set(day, (acc.dayCounts.get(day) ?? 0) + 1);
		}

		const activeIdSet = new Set(activeAllowed.map((a) => a.id));
		const values: TagValueStats[] = [...byValue.entries()]
			.map(([value, acc]) => {
				let worst: string | null = null;
				for (const alertId of acc.alertIds) {
					const severity = meta.get(alertId)?.severity ?? null;
					if (severity && (worst === null || (SEVERITY_RANK[severity] ?? 9) < (SEVERITY_RANK[worst] ?? 9)))
						worst = severity;
				}
				return {
					value,
					episodes: acc.episodes,
					resolvedCount: acc.resolvedDurations.length,
					mttrMs: durationStats(acc.resolvedDurations).meanMs,
					firingNow: [...acc.alertIds].filter((id) => activeIdSet.has(id)).length,
					worstSeverity: worst,
				};
			})
			.sort((a, b) => b.episodes - a.episodes || a.value.localeCompare(b.value));

		// Volume split over the TOP values only — a 40-series chart reads as noise.
		const topValues = values.slice(0, 5).map((v) => v.value);
		const dayPointsByDate = new Map<string, TagValueDayPoint>();
		for (const value of topValues) {
			const acc = byValue.get(value);
			if (!acc) continue;
			for (const [date, count] of acc.dayCounts) {
				let point = dayPointsByDate.get(date);
				if (!point) {
					point = { date, counts: {} };
					dayPointsByDate.set(date, point);
				}
				point.counts[value] = count;
			}
		}

		tagInsights = {
			key,
			values: values.slice(0, 12),
			taggedEpisodes,
			untaggedEpisodes,
			topValues,
			volumeByDay: [...dayPointsByDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
		};
	}

	return {
		range: {
			from: inputs.from,
			to: inputs.to,
			previousFrom: previousFromMs !== null ? new Date(previousFromMs).toISOString() : null,
			filtered: !!allowed,
		},
		overview: {
			totalEpisodes: kpi(windowEpisodes.length, fromMs !== null ? previousEpisodes.length : null),
			resolvedInRange: kpi(resolutionsInRange.length, fromMs !== null ? previousResolutions : null),
			firingNow: activeAllowed.length,
			silencedNow,
			noiseRatio: activeAllowed.length > 0 ? Number((silencedNow / activeAllowed.length).toFixed(3)) : null,
			volumeByDay: [...dayPoints.values()].sort((a, b) => a.date.localeCompare(b.date)),
			volumeByHour: hourCounts.map((count, hour): HourVolumePoint => ({ hour, count })),
			volumeByWeekday: weekdayCounts.map((count, weekday) => ({ weekday, count })),
			severity: severitySlices,
			topAlertNames: topOf(nameCounts, TOP_NAMES),
			topTags: topOf(tagCounts, TOP_TAGS),
			topResponders: topOf(responderCounts, TOP_NAMES),
			availableTagKeys: [...tagKeySet].sort((a, b) => a.localeCompare(b)),
		},
		reliability: {
			mttr: { ...durationStats(mttrSamples), previousMeanMs: previousMeanMs },
			mtta: durationStats(mttaSamples),
			mtbf: { meanMs: mtbfMean, alertsMeasured },
			refireRate: {
				rate: resolutionsInRange.length > 0 ? Number((refired / resolutionsInRange.length).toFixed(3)) : null,
				refired,
				resolutions: resolutionsInRange.length,
			},
			ackCoverage: {
				rate: windowEpisodes.length > 0 ? Number((acked / windowEpisodes.length).toFixed(3)) : null,
				acked,
				episodes: windowEpisodes.length,
			},
			episodesPerDay,
			mttrByDay: [...mttrDayAcc.entries()]
				.map(([date, acc]) => ({ date, meanMs: Math.round(acc.total / acc.count), count: acc.count }))
				.sort((a, b) => a.date.localeCompare(b.date)),
		},
		byName,
		tagInsights,
	};
};
