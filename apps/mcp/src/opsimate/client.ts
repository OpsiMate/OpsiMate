import {
	Alert,
	AlertAnalytics,
	AlertComment,
	AlertFacetsResult,
	AlertHistory,
	AlertListPage,
	AlertListQuery,
	AlertOwnerInfo,
	AlertRootCause,
	Dashboard,
} from '@OpsiMate/shared';
import { CallerCredentials } from './auth';

// OpsiMate's REST API, as the MCP tools use it: one method per read, each a thin
// projection of a /api/v1 endpoint, called with the caller's own credentials. The query
// vocabulary (filters as a JSON record, from/to, search, sort, dir, limit, cursor) is
// the one the UI sends, so results agree with the alerts page.

export interface AlertLookup {
	alert: Alert;
	// True when the alert came from the resolved archive.
	resolved: boolean;
}

export interface AnalyticsQuery {
	from: string | null;
	to: string | null;
	timeZone?: string;
	filters?: Record<string, string[]>;
	search?: string;
	tagKey?: string;
}

// OpsiMate answered with an error status. `status` lets a tool tell "not found" (404)
// and "your credentials were refused" (401/403) from everything else.
export class OpsiMateApiError extends Error {
	constructor(
		readonly status: number,
		readonly path: string,
		message: string
	) {
		super(message);
		this.name = 'OpsiMateApiError';
	}
}

export interface OpsiMateClientOptions {
	fetch?: typeof fetch;
	timeoutMs?: number;
}

interface Envelope<T> {
	success: boolean;
	data?: T;
	error?: string;
}

interface AlertsPageBody {
	alerts: Alert[];
	total?: number;
	nextCursor?: string | null;
}

type QueryParams = Record<string, string | undefined>;

const alertQueryParams = (query: AlertListQuery): QueryParams => ({
	filters: query.filters && Object.keys(query.filters).length > 0 ? JSON.stringify(query.filters) : undefined,
	from: query.from ?? undefined,
	to: query.to ?? undefined,
	search: query.search?.trim() || undefined,
	sort: query.sort,
	dir: query.dir,
	limit: query.limit !== undefined ? String(query.limit) : undefined,
	cursor: query.cursor,
});

export class OpsiMateClient {
	private readonly fetchImpl: typeof fetch;
	private readonly timeoutMs: number;

	constructor(
		private readonly baseUrl: string,
		private readonly credentials: CallerCredentials,
		options: OpsiMateClientOptions = {}
	) {
		this.fetchImpl = options.fetch ?? fetch;
		this.timeoutMs = options.timeoutMs ?? 15_000;
	}

	async listDashboards(): Promise<Dashboard[]> {
		return this.get<Dashboard[]>('/api/v1/dashboards');
	}

	async queryAlerts(query: AlertListQuery): Promise<AlertListPage> {
		return toPage(await this.get<AlertsPageBody>('/api/v1/alerts', withPage(alertQueryParams(query))));
	}

	async queryResolvedAlerts(query: AlertListQuery): Promise<AlertListPage> {
		return toPage(await this.get<AlertsPageBody>('/api/v1/alerts/resolved', withPage(alertQueryParams(query))));
	}

	async getAlertFacets(): Promise<AlertFacetsResult> {
		return this.get<AlertFacetsResult>('/api/v1/alerts/facets');
	}

	async getResolvedAlertFacets(): Promise<AlertFacetsResult> {
		return this.get<AlertFacetsResult>('/api/v1/alerts/resolved/facets');
	}

	async getOwners(): Promise<AlertOwnerInfo[]> {
		return this.get<AlertOwnerInfo[]>('/api/v1/alerts/owners');
	}

	// null when no alert, active or resolved, has this id.
	async getAlert(id: string): Promise<AlertLookup | null> {
		return this.getOrNull<AlertLookup>(`/api/v1/alerts/${encodeURIComponent(id)}`);
	}

	async getComments(alertId: string): Promise<AlertComment[]> {
		const body = await this.get<{ comments: AlertComment[] }>(
			`/api/v1/alerts/${encodeURIComponent(alertId)}/comments`
		);
		return body.comments;
	}

	async getHistory(alertId: string): Promise<AlertHistory> {
		return this.get<AlertHistory>(`/api/v1/alerts/${encodeURIComponent(alertId)}/history`);
	}

	// null when no analysis was pushed for the alert.
	async getRootCause(alertId: string): Promise<AlertRootCause | null> {
		const body = await this.getOrNull<{ rootCause: AlertRootCause | null }>(
			`/api/v1/alerts/${encodeURIComponent(alertId)}/root-cause`
		);
		return body?.rootCause ?? null;
	}

	async getAnalytics(query: AnalyticsQuery): Promise<AlertAnalytics> {
		return this.get<AlertAnalytics>('/api/v1/alerts/analytics', {
			from: query.from ?? undefined,
			to: query.to ?? undefined,
			tz: query.timeZone,
			filters: query.filters && Object.keys(query.filters).length > 0 ? JSON.stringify(query.filters) : undefined,
			search: query.search?.trim() || undefined,
			tagKey: query.tagKey?.trim() || undefined,
		});
	}

	private async getOrNull<T>(path: string, params?: QueryParams): Promise<T | null> {
		try {
			return await this.get<T>(path, params);
		} catch (error) {
			if (error instanceof OpsiMateApiError && error.status === 404) return null;
			throw error;
		}
	}

	private async get<T>(path: string, params: QueryParams = {}): Promise<T> {
		// Relative to the base, so a prefix in OPSIMATE_URL (https://host/opsimate) survives:
		// an absolute path would replace it.
		const url = new URL(path.replace(/^\/+/, ''), `${this.baseUrl.replace(/\/+$/, '')}/`);
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined) url.searchParams.set(key, value);
		}
		const [name, value] = this.credentials.header;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		let response: Response;
		let text: string;
		try {
			response = await this.fetchImpl(url, {
				headers: { accept: 'application/json', [name]: value },
				signal: controller.signal,
			});
			// The body counts against the same deadline: headers that arrive and a body that
			// never does would otherwise hang the tool call forever.
			text = await response.text();
		} catch (error) {
			const reason = error instanceof Error && error.name === 'AbortError' ? 'timed out' : describe(error);
			throw new OpsiMateApiError(0, path, `OpsiMate at ${this.baseUrl} could not be reached (${reason}).`);
		} finally {
			clearTimeout(timer);
		}
		let body: Envelope<T> | undefined;
		try {
			body = JSON.parse(text) as Envelope<T>;
		} catch {
			body = undefined;
		}
		if (!response.ok || !body?.success) {
			const detail = body?.error ?? (text ? text.slice(0, 200) : response.statusText);
			const hint =
				response.status === 401 || response.status === 403
					? ' OpsiMate refused the credentials this MCP client sent.'
					: '';
			throw new OpsiMateApiError(
				response.status,
				path,
				`OpsiMate answered ${response.status}: ${detail}.${hint}`
			);
		}
		return body.data as T;
	}
}

// A page request without an explicit limit would get the server's default; the tools
// always set one, but a bare query (summary counts) must say "everything".
const withPage = (params: QueryParams): QueryParams =>
	params.limit === undefined ? { ...params, limit: '1000' } : params;

const toPage = (body: AlertsPageBody): AlertListPage => ({
	items: body.alerts,
	total: body.total ?? body.alerts.length,
	nextCursor: body.nextCursor ?? null,
});

const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));
