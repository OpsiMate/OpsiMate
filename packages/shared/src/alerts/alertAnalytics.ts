// ---------------------------------------------------------------------------
// Alert analytics: the aggregate payload behind the Insights page. Everything is
// computed SERVER-side over the full history (episodes can number in the tens of
// thousands); the client only ever receives these compact aggregates, so the page
// costs the same whether the installation has a hundred alerts or a million.
//
// Extension pattern: add a field to the relevant section interface, compute it in
// the server's analytics module (one function per section), and render it in the
// matching client tab. Nothing else needs touching.
// ---------------------------------------------------------------------------

// A headline number with its previous-period counterpart, so the UI can show a
// delta ("up 12% vs the previous 7 days"). previous is null when there IS no
// previous period (the "All time" window).
export interface AnalyticsKpi {
	value: number;
	previous: number | null;
}

// Duration aggregates in milliseconds. Mean alone lies under skew (one week-long
// outage doubles it), so the median and p90 ride along; null when nothing in the
// window produced a duration.
export interface DurationStats {
	meanMs: number | null;
	medianMs: number | null;
	p90Ms: number | null;
	count: number;
}

// Time-series bucket size. Short windows (<= 48h) bucket by hour so a 24h view reads
// as a real curve instead of a single point; longer windows bucket by day.
export type BucketGranularity = 'hour' | 'day';

export interface DayVolumePoint {
	// Bucket key in the requester's timezone: "YYYY-MM-DD" for day granularity, or
	// "YYYY-MM-DD HH:00" for hour granularity. See AnalyticsRange.granularity.
	date: string;
	critical: number;
	warning: number;
	info: number;
	total: number;
	// Resolutions that landed on this day — the "are we keeping up" overlay.
	resolved: number;
}

// Day-of-week histogram (0=Sunday … 6=Saturday, matching Date.getDay()).
export interface WeekdayVolumePoint {
	weekday: number;
	count: number;
}

// One duration metric's mean per local day (MTTR over that day's resolutions,
// MTTA over that day's first touches). meanMs is null on days where nothing was
// measured, so trend lines BREAK there instead of bridging the gap.
export interface DurationDayPoint {
	date: string;
	meanMs: number | null;
	count: number;
}

// Hour-of-day histogram (0-23) in the requester's timezone — "when do alerts hit us".
export interface HourVolumePoint {
	hour: number;
	count: number;
}

export interface SeveritySlice {
	severity: string;
	count: number;
}

export interface NamedCount {
	name: string;
	count: number;
}

export interface AnalyticsOverview {
	// Firing episodes that STARTED in the window (an alert firing twice counts twice —
	// this measures load, not inventory).
	totalEpisodes: AnalyticsKpi;
	resolvedInRange: AnalyticsKpi;
	firingNow: number;
	silencedNow: number;
	// silenced+muted share of the currently active list — how much of the noise is
	// being suppressed rather than fixed. Null with no active alerts.
	noiseRatio: number | null;
	volumeByDay: DayVolumePoint[];
	volumeByHour: HourVolumePoint[];
	volumeByWeekday: WeekdayVolumePoint[];
	severity: SeveritySlice[];
	topAlertNames: NamedCount[];
	// "key=value" strings, most frequent across alerts seen in the window.
	topTags: NamedCount[];
	// Who touches alerts the most: user-action counts by actor in the window.
	topResponders: NamedCount[];
	// Tag keys present on alerts seen in the window — feeds the tag-research picker.
	availableTagKeys: string[];
}

// Restore-time stats plus the previous window's mean, for the headline delta.
export interface MttrStats extends DurationStats {
	previousMeanMs: number | null;
}

// Mean gap between consecutive firing episodes of the same alert.
export interface MtbfStats {
	meanMs: number | null;
	alertsMeasured: number;
}

// Change-failure-rate analog: share of resolutions followed by the same alert
// re-firing within 24h — "the fix didn't hold".
export interface RefireRateStats {
	rate: number | null;
	refired: number;
	resolutions: number;
}

// Share of episodes that received ANY human action while firing.
export interface AckCoverageStats {
	rate: number | null;
	acked: number;
	episodes: number;
}

// The reliability tab: DORA's restore-time metric plus the alert-world adaptations
// of its siblings. Deployment-centric DORA metrics (deployment frequency, lead
// time) have no alert analog and are deliberately absent.
export interface AnalyticsReliability {
	// DORA "time to restore service": firing -> resolved, per episode resolved in
	// the window.
	mttr: MttrStats;
	// Time to first human touch (own/silence/comment/action/resolve) after firing.
	mtta: DurationStats;
	mtbf: MtbfStats;
	refireRate: RefireRateStats;
	ackCoverage: AckCoverageStats;
	// Episodes per day over the window — the alert-world "how often does it burn".
	episodesPerDay: AnalyticsKpi;
	// Restore-time trend, per local day — the chart behind the MTTR headline.
	mttrByDay: DurationDayPoint[];
	// Time-to-first-human-touch trend, per local day (bucketed by the day the
	// touch happened) — the MTTA view of the same chart.
	mttaByDay: DurationDayPoint[];
}

// One row of the per-alert-name breakdown table.
export interface AlertNameStats {
	name: string;
	episodes: number;
	firingNow: number;
	mttrMs: number | null;
	mtbfMs: number | null;
	refireRate: number | null;
	worstSeverity: string | null;
	lastSeen: string;
}

export interface AnalyticsRange {
	from: string | null;
	to: string;
	// Start of the equally-long window immediately before `from`; null on All time.
	previousFrom: string | null;
	// True when a dashboard's filters/search narrowed the scope.
	filtered: boolean;
	// Bucket size of the time-series fields (volumeByDay, mttrByDay, ...) so the client
	// formats the x-axis accordingly.
	granularity: BucketGranularity;
}

// One tag VALUE's aggregate row inside the tag-research view.
export interface TagValueStats {
	value: string;
	episodes: number;
	resolvedCount: number;
	mttrMs: number | null;
	firingNow: number;
	worstSeverity: string | null;
}

// Daily volume split by tag value (top values only; series order in `topValues`).
export interface TagValueDayPoint {
	date: string;
	counts: Record<string, number>;
}

// One tag VALUE's duration trends — its own MTTR/MTTA line on the tag trend chart.
export interface TagValueTrend {
	value: string;
	mttrByDay: DurationDayPoint[];
	mttaByDay: DurationDayPoint[];
}

// The tag-research section: everything about ONE tag key, computed only when the
// request names a key — the tab pays for what it looks at, nothing more.
export interface TagInsights {
	key: string;
	values: TagValueStats[];
	// Episodes whose alert carries the key vs not — how meaningful this breakdown is.
	taggedEpisodes: number;
	untaggedEpisodes: number;
	topValues: string[];
	volumeByDay: TagValueDayPoint[];
	// Per-VALUE MTTR/MTTA trends (top values only, `topValues` order) — the same day
	// semantics as the reliability trends, one line per value.
	trends: TagValueTrend[];
}

export interface AlertAnalytics {
	range: AnalyticsRange;
	overview: AnalyticsOverview;
	reliability: AnalyticsReliability;
	byName: AlertNameStats[];
	// Present only when the request asked to research a tag key.
	tagInsights?: TagInsights;
}
