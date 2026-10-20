import {
	Dashboard,
	extractTagKeyFromColumnId,
	isQuickTimePreset,
	isTagKeyColumn,
	QUICK_TIME_PRESETS,
	resolveDashboardTimeRange,
	ResolvedTimeWindow,
} from '@OpsiMate/shared';
import { parseDashboardFilters } from './project';
import { toCoarseWindow } from './timeWindow';

// Finding a dashboard the way a person names it, and turning it into the alerts query it
// stands for — the same filters + search + rolling window the UI applies when it is open.

export interface DashboardRef {
	id?: string;
	name?: string;
}

export interface DashboardFound {
	ok: true;
	dashboard: Dashboard;
}

export interface DashboardNotFound {
	ok: false;
	message: string;
}

export type DashboardResolution = DashboardFound | DashboardNotFound;

const listNames = (dashboards: Dashboard[]): string =>
	dashboards.map((dashboard) => `"${dashboard.name}" (id ${dashboard.id})`).join(', ');

// By id when given; otherwise by name — an exact (case-insensitive) match wins, else a
// substring that singles out one dashboard. Every miss names the candidates, so the
// caller's next attempt can be exact.
export const resolveDashboardRef = (dashboards: Dashboard[], ref: DashboardRef): DashboardResolution => {
	const id = ref.id?.trim();
	const name = ref.name?.trim();
	if (id) {
		const dashboard = dashboards.find((candidate) => String(candidate.id) === id);
		if (dashboard) return { ok: true, dashboard };
		return {
			ok: false,
			message:
				`No dashboard with id "${id}". ` +
				(dashboards.length > 0 ? `Dashboards: ${listNames(dashboards)}.` : 'There are no dashboards yet.'),
		};
	}
	if (!name) return { ok: false, message: 'Give the dashboard id or name.' };
	const lower = name.toLowerCase();
	const exact = dashboards.filter((candidate) => candidate.name.toLowerCase() === lower);
	if (exact.length === 1) return { ok: true, dashboard: exact[0] };
	if (exact.length > 1) {
		return { ok: false, message: `Several dashboards are named "${name}": ${listNames(exact)}. Use the id.` };
	}
	const partial = dashboards.filter((candidate) => candidate.name.toLowerCase().includes(lower));
	if (partial.length === 1) return { ok: true, dashboard: partial[0] };
	if (partial.length > 1) {
		return { ok: false, message: `"${name}" matches several dashboards: ${listNames(partial)}. Be more specific.` };
	}
	return {
		ok: false,
		message:
			`No dashboard named "${name}". ` +
			(dashboards.length > 0 ? `Dashboards: ${listNames(dashboards)}.` : 'There are no dashboards yet.'),
	};
};

export interface DashboardAlertScope {
	filters: Record<string, string[]>;
	search: string | undefined;
	window: ResolvedTimeWindow;
}

export interface DashboardScopeOptions {
	timeZone: string | undefined;
	// The resolved archive rather than the active list.
	resolved: boolean;
}

// The dashboard's rolling window right now, coarse to the minute like the client's. A
// stored absolute range is kept exactly.
export const resolveDashboardWindow = (dashboard: Dashboard, timeZone: string | undefined): ResolvedTimeWindow => {
	const range = dashboard.timeRange;
	if (!range || !isQuickTimePreset(range.preset)) return resolveDashboardTimeRange(range, { timeZone });
	const resolved = resolveDashboardTimeRange(range, { timeZone });
	return toCoarseWindow(resolved.from ? new Date(resolved.from) : null, resolved.to ? new Date(resolved.to) : null);
};

// The query a dashboard means. For the RESOLVED list the status filter is suspended, as
// the UI does: a dashboard filtered to "Firing" still shows its resolved alerts under the
// Resolved tab, and a status filter would otherwise empty that list.
export const dashboardAlertScope = (dashboard: Dashboard, options: DashboardScopeOptions): DashboardAlertScope => {
	const { status: _status, ['!status']: _notStatus, ...rest } = parseDashboardFilters(dashboard.filters);
	return {
		filters: options.resolved ? rest : parseDashboardFilters(dashboard.filters),
		search: dashboard.query?.trim() || undefined,
		window: resolveDashboardWindow(dashboard, options.timeZone),
	};
};

const fieldLabel = (field: string): string => {
	if (isTagKeyColumn(field)) return `tag "${extractTagKeyFromColumnId(field) ?? field}"`;
	return field;
};

// One sentence an assistant can repeat to the user: what the dashboard shows.
export const describeDashboardScope = (dashboard: Dashboard, window: ResolvedTimeWindow): string => {
	const parts: string[] = [];
	for (const [key, values] of Object.entries(parseDashboardFilters(dashboard.filters))) {
		if (values.length === 0) continue;
		const exclusion = key.startsWith('!');
		const field = fieldLabel(exclusion ? key.slice(1) : key);
		parts.push(`${field} ${exclusion ? 'is not' : 'is'} ${values.map((value) => `"${value}"`).join(' or ')}`);
	}
	const search = dashboard.query?.trim();
	if (search) parts.push(`name or summary contains "${search}"`);
	const preset = dashboard.timeRange?.preset;
	if (isQuickTimePreset(preset)) {
		const label = QUICK_TIME_PRESETS.find((config) => config.value === preset)?.label ?? preset;
		parts.push(`time: ${label.toLowerCase()} (${window.from ?? '…'} to ${window.to ?? 'now'})`);
	} else if (window.from || window.to) {
		parts.push(`time: ${window.from ?? 'the beginning'} to ${window.to ?? 'now'}`);
	}
	return parts.length > 0 ? `Shows alerts where ${parts.join('; ')}.` : 'Shows every alert (no filters).';
};
