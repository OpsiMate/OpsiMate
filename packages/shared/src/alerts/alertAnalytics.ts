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

export interface DayVolumePoint {
	// Local calendar date (YYYY-MM-DD) in the requester's timezone.
	date: string;
	critical: number;
	warning: number;
	info: number;
	total: number;
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
	severity: SeveritySlice[];
	topAlertNames: NamedCount[];
	// "key=value" strings, most frequent across alerts seen in the window.
	topTags: NamedCount[];
}

// The reliability tab: DORA's restore-time metric plus the alert-world adaptations
// of its siblings. Deployment-centric DORA metrics (deployment frequency, lead
// time) have no alert analog and are deliberately absent.
export interface AnalyticsReliability {
	// DORA "time to restore service": firing -> resolved, per episode resolved in
	// the window.
	mttr: DurationStats & { previousMeanMs: number | null };
	// Time to first human touch (own/silence/comment/action/resolve) after firing.
	mtta: DurationStats;
	// Mean gap between consecutive firing episodes of the same alert.
	mtbf: { meanMs: number | null; alertsMeasured: number };
	// Change-failure-rate analog: share of resolutions followed by the same alert
	// re-firing within 24h — "the fix didn't hold".
	refireRate: { rate: number | null; refired: number; resolutions: number };
	// Share of episodes that received ANY human action while firing.
	ackCoverage: { rate: number | null; acked: number; episodes: number };
	// Episodes per day over the window — the alert-world "how often does it burn".
	episodesPerDay: AnalyticsKpi;
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
}

export interface AlertAnalytics {
	range: AnalyticsRange;
	overview: AnalyticsOverview;
	reliability: AnalyticsReliability;
	byName: AlertNameStats[];
}
