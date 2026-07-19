import { AlertHistoryData, AlertHistoryEventType, AlertStatus, OncallTeam } from '@OpsiMate/shared';
import { http, HttpResponse } from 'msw';
import { getPlaygroundUser, OncallTeamState, playgroundState, randomId } from './state';

const API_BASE = '*/api/v1';
const nowIso = () => new Date().toISOString();

const PLAYGROUND_ACTOR = getPlaygroundUser().fullName;
const SECONDARY_ACTOR = 'Dana Cohen';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const hashAlertId = (id: string): number => {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
	return h;
};

// Deterministic, time-spread base history per alert so the timeline is rich and the time
// filter is demonstrable: events range from ~25 minutes ago to ~2 weeks ago.
const generateBaseHistory = (alertId: string): AlertHistoryData[] => {
	const now = Date.now();
	const h = hashAlertId(alertId);
	const actionName = ['Notify #oncall', 'Post to Teams', 'Open Jira incident'][h % 3];
	return [
		{
			date: new Date(now - (25 + (h % 20)) * MINUTE).toISOString(),
			eventType: AlertHistoryEventType.ACTION_RUN,
			actorName: PLAYGROUND_ACTOR,
			description: `Ran action "${actionName}"`,
		},
		{
			date: new Date(now - 5 * HOUR).toISOString(),
			eventType: AlertHistoryEventType.OWNER_ASSIGNED,
			actorName: PLAYGROUND_ACTOR,
			description: `Assigned to ${PLAYGROUND_ACTOR}`,
		},
		{
			date: new Date(now - 26 * HOUR).toISOString(),
			eventType: AlertHistoryEventType.STATUS_CHANGED,
			status: AlertStatus.FIRING,
			description: 'Alert started firing',
		},
		{
			date: new Date(now - 3 * DAY).toISOString(),
			eventType: AlertHistoryEventType.SILENCED,
			actorName: SECONDARY_ACTOR,
			description: 'Alert silenced',
		},
		{
			date: new Date(now - 9 * DAY).toISOString(),
			eventType: AlertHistoryEventType.OWNER_UNASSIGNED,
			actorName: SECONDARY_ACTOR,
			description: 'Owner removed',
		},
		{
			date: new Date(now - 14 * DAY).toISOString(),
			eventType: AlertHistoryEventType.STATUS_CHANGED,
			status: AlertStatus.RESOLVED,
			description: 'Alert resolved',
		},
	];
};

// Appends a live event to an alert's history (newest first).
const pushAlertEvent = (alertId: string, event: AlertHistoryData): void => {
	if (!playgroundState.alertHistoryEvents[alertId]) {
		playgroundState.alertHistoryEvents[alertId] = [];
	}
	playgroundState.alertHistoryEvents[alertId].unshift(event);
};

const ownerNameById = (ownerId: string | null): string => {
	if (!ownerId) return 'someone';
	return playgroundState.users.find((u) => u.id === ownerId)?.fullName ?? `user #${ownerId}`;
};

const recordOwnerEvent = (ownerId: string | null): AlertHistoryData => ({
	date: nowIso(),
	eventType: ownerId ? AlertHistoryEventType.OWNER_ASSIGNED : AlertHistoryEventType.OWNER_UNASSIGNED,
	actorName: PLAYGROUND_ACTOR,
	description: ownerId ? `Assigned to ${ownerNameById(ownerId)}` : 'Owner removed',
});

const isPlaygroundModeFromEnv = (): boolean => {
	if (typeof window === 'undefined') return false;
	return import.meta.env.VITE_PLAYGROUND_MODE === 'true';
};

const shouldBlockWriteOperation = (): boolean => {
	return isPlaygroundModeFromEnv();
};

// Mirrors the server's enrichment matching so the demo can show which rules decorated an alert.
const withAppliedEnrichments = <T extends { alertName?: string; tags?: Record<string, string> }>(alert: T): T => {
	const applied = playgroundState.enrichments
		.filter((e) => {
			const hasName = !!e.nameContains && e.nameContains.trim().length > 0;
			const matchers = e.labelMatchers ?? [];
			if (!hasName && matchers.length === 0) return false;
			if (hasName && !alert.alertName?.toLowerCase().includes(e.nameContains!.trim().toLowerCase())) {
				return false;
			}
			return matchers.every((m) => alert.tags?.[m.key] === m.value);
		})
		.map((e) => ({ id: e.id, name: e.name }));
	return applied.length > 0 ? { ...alert, appliedEnrichments: applied } : alert;
};

// Mirrors the server's rotation arithmetic: every rotationIntervalDays since the anchor,
// the on-call duty shifts one place down the member list, wrapping around.
const toOncallTeam = (team: OncallTeamState): OncallTeam => {
	const interval = team.rotationIntervalDays ?? 0;
	const count = team.userIds.length;
	let shift = 0;
	let nextRotationAt: string | null = null;
	if (interval > 0 && count > 0) {
		const anchorMs = new Date(team.rotationAnchor).getTime();
		const elapsed = Math.max(0, Date.now() - anchorMs);
		const periods = Math.floor(elapsed / (interval * DAY));
		shift = periods % count;
		nextRotationAt = new Date(anchorMs + (periods + 1) * interval * DAY).toISOString();
	}
	const members = team.userIds.map((userId, position) => {
		const user = playgroundState.users.find((u) => u.id === userId);
		return {
			userId,
			fullName: user?.fullName ?? `user #${userId}`,
			email: user?.email ?? '',
			phoneNumber: user?.phoneNumber ?? null,
			priority: ((position - shift + count) % count) + 1,
		};
	});
	members.sort((a, b) => a.priority - b.priority);
	return {
		id: team.id,
		name: team.name,
		rotationIntervalDays: team.rotationIntervalDays,
		rotationAnchor: team.rotationAnchor,
		members,
		nextRotationAt,
	};
};

export const handlers = [
	// ==================== ALERTS ====================
	http.get(`${API_BASE}/alerts`, () => {
		return HttpResponse.json({
			success: true,
			data: { alerts: playgroundState.alerts.map(withAppliedEnrichments) },
		});
	}),

	http.get(`${API_BASE}/alerts/resolved`, () => {
		return HttpResponse.json({
			success: true,
			data: { alerts: playgroundState.resolvedAlerts },
		});
	}),

	http.patch(`${API_BASE}/alerts/:alertId/silence`, ({ params }) => {
		const alertId = params.alertId as string;
		const alert = playgroundState.alerts.find((a) => a.id === alertId);

		if (!alert) {
			return HttpResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
		}

		alert.isSilenced = true;
		alert.updatedAt = nowIso();
		pushAlertEvent(alertId, {
			date: nowIso(),
			eventType: AlertHistoryEventType.SILENCED,
			actorName: PLAYGROUND_ACTOR,
			description: 'Alert silenced',
		});

		return HttpResponse.json({ success: true, data: { alert } });
	}),

	http.patch(`${API_BASE}/alerts/:alertId/unsilence`, ({ params }) => {
		const alertId = params.alertId as string;
		const alert = playgroundState.alerts.find((a) => a.id === alertId);

		if (!alert) {
			return HttpResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
		}

		alert.isSilenced = false;
		alert.updatedAt = nowIso();
		pushAlertEvent(alertId, {
			date: nowIso(),
			eventType: AlertHistoryEventType.UNSILENCED,
			actorName: PLAYGROUND_ACTOR,
			description: 'Alert unsilenced',
		});

		return HttpResponse.json({ success: true, data: { alert } });
	}),

	http.patch(`${API_BASE}/alerts/:alertId/read`, ({ params }) => {
		const alertId = params.alertId as string;
		const alert = playgroundState.alerts.find((a) => a.id === alertId);
		if (!alert) {
			return HttpResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
		}
		alert.isRead = true;
		return HttpResponse.json({ success: true, data: { alert } });
	}),

	http.patch(`${API_BASE}/alerts/:alertId/owner`, async ({ params, request }) => {
		const alertId = params.alertId as string;
		const body = (await request.json()) as { ownerId: string | null };
		const alert = playgroundState.alerts.find((a) => a.id === alertId);

		if (!alert) {
			return HttpResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
		}

		alert.ownerId = body.ownerId;
		alert.updatedAt = nowIso();
		pushAlertEvent(alertId, recordOwnerEvent(body.ownerId));

		return HttpResponse.json({ success: true, data: { alert } });
	}),

	http.patch(`${API_BASE}/alerts/resolved/:alertId/owner`, async ({ params, request }) => {
		const alertId = params.alertId as string;
		const body = (await request.json()) as { ownerId: string | null };
		const alert = playgroundState.resolvedAlerts.find((a) => a.id === alertId);

		if (!alert) {
			return HttpResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
		}

		alert.ownerId = body.ownerId;
		alert.updatedAt = nowIso();
		pushAlertEvent(alertId, recordOwnerEvent(body.ownerId));

		return HttpResponse.json({ success: true, data: { alert } });
	}),

	http.delete(`${API_BASE}/alerts/:alertId`, async ({ params, request }) => {
		const alertId = params.alertId as string;
		const alertIndex = playgroundState.alerts.findIndex((a) => a.id === alertId);

		if (alertIndex === -1) {
			return HttpResponse.json({ success: true, message: 'Alert not found, nothing to resolve' });
		}

		// Optional resolve note in the body (mirrors the server: stored as a comment).
		const body = (await request.json().catch(() => null)) as { comment?: string } | null;
		const resolveComment = typeof body?.comment === 'string' ? body.comment.trim() : '';

		const alert = { ...playgroundState.alerts[alertIndex] };
		// Resolving pins the status and clears silence — an alert is either silenced or
		// resolved, never both.
		alert.status = AlertStatus.RESOLVED;
		alert.isSilenced = false;
		alert.updatedAt = nowIso();
		// The resolver takes ownership of the alert (mirrors the server).
		alert.ownerId = getPlaygroundUser().id;

		playgroundState.alerts.splice(alertIndex, 1);
		playgroundState.resolvedAlerts.unshift(alert);
		// The playground "Resolve" action is always a manual resolve by the playground user.
		pushAlertEvent(alertId, {
			date: nowIso(),
			eventType: AlertHistoryEventType.RESOLVED,
			actorName: PLAYGROUND_ACTOR,
			description: 'Alert resolved manually',
		});
		if (resolveComment) {
			playgroundState.alertComments.push({
				id: `comment-${randomId()}`,
				alertId,
				userId: getPlaygroundUser().id,
				comment: resolveComment,
				createdAt: nowIso(),
				updatedAt: nowIso(),
			});
		}

		return HttpResponse.json({ success: true, message: 'Alert deleted successfully' });
	}),

	http.patch(`${API_BASE}/alerts/resolved/:alertId/unresolve`, ({ params }) => {
		const alertId = params.alertId as string;
		const alertIndex = playgroundState.resolvedAlerts.findIndex((a) => a.id === alertId);

		if (alertIndex === -1) {
			return HttpResponse.json({ success: false, error: 'Resolved alert not found' }, { status: 404 });
		}

		const alert = { ...playgroundState.resolvedAlerts[alertIndex] };
		alert.status = AlertStatus.FIRING;
		alert.isSilenced = false;
		alert.isRead = false;
		alert.updatedAt = nowIso();

		playgroundState.resolvedAlerts.splice(alertIndex, 1);
		playgroundState.alerts.unshift(alert);
		pushAlertEvent(alertId, {
			date: nowIso(),
			eventType: AlertHistoryEventType.UNRESOLVED,
			actorName: PLAYGROUND_ACTOR,
			description: 'Alert moved back to firing',
		});

		return HttpResponse.json({ success: true, data: { alert } });
	}),

	http.delete(`${API_BASE}/alerts/resolved/:alertId`, ({ params }) => {
		const alertId = params.alertId as string;
		playgroundState.resolvedAlerts = playgroundState.resolvedAlerts.filter((a) => a.id !== alertId);
		return HttpResponse.json({ success: true, message: 'Resolved alert deleted permanently' });
	}),

	http.get(`${API_BASE}/alerts/:alertId/history`, ({ params }) => {
		const alertId = params.alertId as string;
		const live = playgroundState.alertHistoryEvents[alertId] ?? [];
		const data = [...live, ...generateBaseHistory(alertId)].sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
		);
		return HttpResponse.json({ success: true, data: { alertId, data } });
	}),

	// ==================== ALERT COMMENTS ====================
	http.get(`${API_BASE}/alerts/:alertId/comments`, ({ params }) => {
		const alertId = params.alertId as string;
		const comments = playgroundState.alertComments.filter((c) => c.alertId === alertId);
		return HttpResponse.json({ success: true, data: { comments } });
	}),

	http.post(`${API_BASE}/alerts/:alertId/comments`, async ({ params, request }) => {
		const alertId = params.alertId as string;
		const body = (await request.json()) as { userId: string; comment: string };

		const newComment = {
			id: `comment-${randomId()}`,
			alertId,
			userId: body.userId,
			comment: body.comment,
			createdAt: nowIso(),
			updatedAt: nowIso(),
		};

		playgroundState.alertComments.push(newComment);
		// Comments are not recorded in the alert history timeline.
		return HttpResponse.json({ success: true, data: { comment: newComment } });
	}),

	http.patch(`${API_BASE}/alerts/comments/:commentId`, async ({ params, request }) => {
		const commentId = params.commentId as string;
		const body = (await request.json()) as { comment: string };
		const comment = playgroundState.alertComments.find((c) => c.id === commentId);

		if (!comment) {
			return HttpResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });
		}

		comment.comment = body.comment;
		comment.updatedAt = nowIso();

		return HttpResponse.json({ success: true, data: { comment } });
	}),

	http.delete(`${API_BASE}/alerts/comments/:commentId`, ({ params }) => {
		const commentId = params.commentId as string;
		playgroundState.alertComments = playgroundState.alertComments.filter((c) => c.id !== commentId);
		return HttpResponse.json({ success: true, message: 'Comment deleted successfully' });
	}),

	// ==================== PROVIDERS ====================
	http.get(`${API_BASE}/providers`, () => {
		return HttpResponse.json({
			success: true,
			data: { providers: playgroundState.providers },
		});
	}),

	http.post(`${API_BASE}/providers`, async ({ request }) => {
		const body = (await request.json()) as Partial<(typeof playgroundState.providers)[0]>;
		const newProvider = {
			...body,
			id: randomId(),
			createdAt: nowIso(),
		} as (typeof playgroundState.providers)[0];

		playgroundState.providers.push(newProvider);
		return HttpResponse.json({ success: true, data: { provider: newProvider } });
	}),

	http.put(`${API_BASE}/providers/:id`, async ({ params, request }) => {
		const id = Number(params.id);
		const body = (await request.json()) as Partial<(typeof playgroundState.providers)[0]>;
		const provider = playgroundState.providers.find((p) => p.id === id);

		if (!provider) {
			return HttpResponse.json({ success: false, error: 'Provider not found' }, { status: 404 });
		}

		Object.assign(provider, body);
		return HttpResponse.json({ success: true, data: { provider } });
	}),

	http.delete(`${API_BASE}/providers/:id`, ({ params }) => {
		const id = Number(params.id);
		playgroundState.providers = playgroundState.providers.filter((p) => p.id !== id);
		return HttpResponse.json({ success: true });
	}),

	// ==================== SERVICES ====================
	http.get(`${API_BASE}/services`, () => {
		return HttpResponse.json({
			success: true,
			data: playgroundState.services,
		});
	}),

	http.get(`${API_BASE}/services/:id`, ({ params }) => {
		const id = Number(params.id);
		const service = playgroundState.services.find((s) => s.id === id);

		if (!service) {
			return HttpResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
		}

		return HttpResponse.json({ success: true, data: { service } });
	}),

	// ==================== TAGS ====================
	http.get(`${API_BASE}/tags`, () => {
		return HttpResponse.json({
			success: true,
			data: playgroundState.tags,
		});
	}),

	http.post(`${API_BASE}/tags`, async ({ request }) => {
		const body = (await request.json()) as { name: string; color: string };
		const newTag = {
			id: randomId(),
			name: body.name,
			color: body.color,
			createdAt: nowIso(),
		};

		playgroundState.tags.push(newTag);
		return HttpResponse.json({ success: true, data: newTag });
	}),

	http.delete(`${API_BASE}/tags/:id`, ({ params }) => {
		const id = Number(params.id);
		playgroundState.tags = playgroundState.tags.filter((t) => t.id !== id);
		return HttpResponse.json({ success: true });
	}),

	// ==================== INTEGRATIONS ====================
	http.get(`${API_BASE}/integrations`, () => {
		return HttpResponse.json({
			success: true,
			data: { integrations: playgroundState.integrations },
		});
	}),

	// ==================== DASHBOARDS ====================
	http.get(`${API_BASE}/dashboards`, () => {
		return HttpResponse.json({
			success: true,
			data: playgroundState.dashboards,
		});
	}),

	http.post(`${API_BASE}/dashboards`, async ({ request }) => {
		const body = (await request.json()) as Partial<(typeof playgroundState.dashboards)[0]>;
		const newDashboard = {
			...body,
			id: String(randomId()),
			createdAt: nowIso(),
		} as (typeof playgroundState.dashboards)[0];

		playgroundState.dashboards.push(newDashboard);
		return HttpResponse.json({ success: true, data: { id: newDashboard.id } });
	}),

	http.put(`${API_BASE}/dashboards/:id`, async ({ params, request }) => {
		const id = params.id as string;
		const body = (await request.json()) as Partial<(typeof playgroundState.dashboards)[0]>;
		const dashboard = playgroundState.dashboards.find((d) => d.id === id);

		if (!dashboard) {
			return HttpResponse.json({ success: false, error: 'Dashboard not found' }, { status: 404 });
		}

		Object.assign(dashboard, body);
		return HttpResponse.json({ success: true, data: null });
	}),

	http.delete(`${API_BASE}/dashboards/:id`, ({ params }) => {
		const id = params.id as string;
		const dashboardIndex = playgroundState.dashboards.findIndex((d) => d.id === id);

		if (dashboardIndex === -1) {
			return HttpResponse.json(
				{ success: false, error: 'dashboard not found or could not be deleted' },
				{ status: 404 }
			);
		}

		playgroundState.dashboards.splice(dashboardIndex, 1);
		return HttpResponse.json({ success: true, message: 'dashboards deleted successfully' });
	}),

	// Dashboard Tags
	http.get(`${API_BASE}/dashboards/tags`, () => {
		const dashboardTags: Array<{ dashboardId: string; tags: typeof playgroundState.tags }> = [];
		for (const dashboard of playgroundState.dashboards) {
			const tagIds = playgroundState.dashboardTags[dashboard.id] || [];
			const tags = playgroundState.tags.filter((t) => tagIds.includes(t.id));
			dashboardTags.push({
				dashboardId: dashboard.id,
				tags,
			});
		}
		return HttpResponse.json({
			success: true,
			data: dashboardTags,
		});
	}),

	http.get(`${API_BASE}/dashboards/:dashboardId/tags`, ({ params }) => {
		const dashboardId = params.dashboardId as string;
		const dashboard = playgroundState.dashboards.find((d) => d.id === dashboardId);
		if (!dashboard) {
			return HttpResponse.json({ success: false, error: 'Dashboard not found' }, { status: 404 });
		}
		const tagIds = playgroundState.dashboardTags[dashboardId] || [];
		const tags = playgroundState.tags.filter((t) => tagIds.includes(t.id));
		return HttpResponse.json({
			success: true,
			data: tags,
		});
	}),

	http.post(`${API_BASE}/dashboards/:dashboardId/tags`, async ({ params, request }) => {
		const dashboardId = params.dashboardId as string;
		const body = (await request.json()) as { tagId: number };
		const dashboard = playgroundState.dashboards.find((d) => d.id === dashboardId);
		if (!dashboard) {
			return HttpResponse.json({ success: false, error: 'Dashboard not found' }, { status: 404 });
		}
		const tag = playgroundState.tags.find((t) => t.id === body.tagId);
		if (!tag) {
			return HttpResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
		}
		if (!playgroundState.dashboardTags[dashboardId]) {
			playgroundState.dashboardTags[dashboardId] = [];
		}
		if (!playgroundState.dashboardTags[dashboardId].includes(body.tagId)) {
			playgroundState.dashboardTags[dashboardId].push(body.tagId);
		}
		return HttpResponse.json({ success: true });
	}),

	http.delete(`${API_BASE}/dashboards/:dashboardId/tags/:tagId`, ({ params }) => {
		const dashboardId = params.dashboardId as string;
		const tagId = Number(params.tagId);
		const dashboard = playgroundState.dashboards.find((d) => d.id === dashboardId);
		if (!dashboard) {
			return HttpResponse.json({ success: false, error: 'Dashboard not found' }, { status: 404 });
		}
		const tag = playgroundState.tags.find((t) => t.id === tagId);
		if (!tag) {
			return HttpResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
		}
		if (playgroundState.dashboardTags[dashboardId]) {
			playgroundState.dashboardTags[dashboardId] = playgroundState.dashboardTags[dashboardId].filter(
				(id) => id !== tagId
			);
		}
		return HttpResponse.json({ success: true });
	}),

	// ==================== SAVED VIEWS ====================
	http.get(`${API_BASE}/views`, () => {
		return HttpResponse.json({
			success: true,
			data: playgroundState.views,
		});
	}),

	http.post(`${API_BASE}/views`, async ({ request }) => {
		const body = (await request.json()) as Partial<(typeof playgroundState.views)[0]>;
		const newView = {
			...body,
			id: `v-${randomId()}`,
			createdAt: nowIso(),
		} as (typeof playgroundState.views)[0];

		playgroundState.views.push(newView);
		return HttpResponse.json({ success: true, data: { view: newView } });
	}),

	http.put(`${API_BASE}/views/:id`, async ({ params, request }) => {
		const id = params.id as string;
		const body = (await request.json()) as Partial<(typeof playgroundState.views)[0]>;
		const view = playgroundState.views.find((v) => v.id === id);

		if (!view) {
			return HttpResponse.json({ success: false, error: 'View not found' }, { status: 404 });
		}

		Object.assign(view, body);
		return HttpResponse.json({ success: true, data: { view } });
	}),

	http.delete(`${API_BASE}/views/:id`, ({ params }) => {
		const id = params.id as string;
		playgroundState.views = playgroundState.views.filter((v) => v.id !== id);
		return HttpResponse.json({ success: true });
	}),

	// ==================== USERS ====================
	http.get(`${API_BASE}/users`, () => {
		return HttpResponse.json({
			success: true,
			data: playgroundState.users,
		});
	}),

	http.get(`${API_BASE}/users/exists`, () => {
		return HttpResponse.json({ success: true, exists: true });
	}),

	http.get(`${API_BASE}/users/me`, () => {
		return HttpResponse.json({
			success: true,
			data: getPlaygroundUser(),
		});
	}),

	http.get(`${API_BASE}/users/profile`, () => {
		// Serve from state so seeded/edited fields (e.g. phone number) show up.
		const user = playgroundState.users.find((u) => u.id === getPlaygroundUser().id) ?? getPlaygroundUser();
		return HttpResponse.json({
			success: true,
			data: user,
		});
	}),

	http.patch(`${API_BASE}/users/profile`, async ({ request }) => {
		const body = (await request.json()) as { fullName: string; phoneNumber?: string; newPassword?: string };
		const user = playgroundState.users.find((u) => u.id === getPlaygroundUser().id);
		if (user) {
			user.fullName = body.fullName;
			user.phoneNumber = body.phoneNumber || null;
		}
		return HttpResponse.json({
			success: true,
			data: { user: { ...getPlaygroundUser(), fullName: body.fullName, phoneNumber: body.phoneNumber || null } },
		});
	}),

	// ==================== ON-CALL ====================
	http.get(`${API_BASE}/oncall/teams`, () => {
		return HttpResponse.json({
			success: true,
			data: { teams: playgroundState.oncallTeams.map(toOncallTeam) },
		});
	}),

	http.post(`${API_BASE}/oncall/teams`, async ({ request }) => {
		const body = (await request.json()) as { name: string; rotationIntervalDays?: number | null };
		if (playgroundState.oncallTeams.some((t) => t.name.toLowerCase() === body.name.toLowerCase())) {
			return HttpResponse.json(
				{ success: false, error: `A team named "${body.name}" already exists` },
				{ status: 409 }
			);
		}
		const team = {
			id: randomId(),
			name: body.name,
			rotationIntervalDays: body.rotationIntervalDays || null,
			rotationAnchor: nowIso(),
			userIds: [],
		};
		playgroundState.oncallTeams.push(team);
		return HttpResponse.json({ success: true, data: { team: toOncallTeam(team) } }, { status: 201 });
	}),

	http.patch(`${API_BASE}/oncall/teams/:teamId`, async ({ params, request }) => {
		const team = playgroundState.oncallTeams.find((t) => t.id === Number(params.teamId));
		if (!team) {
			return HttpResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
		}
		const body = (await request.json()) as { name?: string; rotationIntervalDays?: number | null };
		if (
			body.name !== undefined &&
			playgroundState.oncallTeams.some(
				(t) => t.id !== team.id && t.name.toLowerCase() === body.name!.toLowerCase()
			)
		) {
			return HttpResponse.json(
				{ success: false, error: `A team named "${body.name}" already exists` },
				{ status: 409 }
			);
		}
		if (body.name !== undefined) team.name = body.name;
		if (body.rotationIntervalDays !== undefined) {
			team.rotationIntervalDays = body.rotationIntervalDays || null;
			team.rotationAnchor = nowIso();
		}
		return HttpResponse.json({ success: true, data: { team: toOncallTeam(team) } });
	}),

	http.delete(`${API_BASE}/oncall/teams/:teamId`, ({ params }) => {
		playgroundState.oncallTeams = playgroundState.oncallTeams.filter((t) => t.id !== Number(params.teamId));
		return HttpResponse.json({ success: true, message: 'Team deleted' });
	}),

	http.put(`${API_BASE}/oncall/teams/:teamId/members`, async ({ params, request }) => {
		const team = playgroundState.oncallTeams.find((t) => t.id === Number(params.teamId));
		if (!team) {
			return HttpResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
		}
		const body = (await request.json()) as { userIds: (string | number)[] };
		team.userIds = body.userIds.map(String);
		team.rotationAnchor = nowIso();
		return HttpResponse.json({ success: true, data: { team: toOncallTeam(team) } });
	}),

	// ==================== AUDIT ====================
	http.get(`${API_BASE}/audit`, () => {
		return HttpResponse.json({
			success: true,
			data: {
				logs: playgroundState.auditLogs,
				total: playgroundState.auditLogs.length,
			},
		});
	}),

	// ==================== CUSTOM ACTIONS ====================
	http.get(`${API_BASE}/custom-actions`, () => {
		return HttpResponse.json({
			success: true,
			data: { actions: playgroundState.customActions },
		});
	}),

	http.post(`${API_BASE}/custom-actions`, async ({ request }) => {
		const body = (await request.json()) as (typeof playgroundState.customActions)[0];
		const newAction = { ...body, id: randomId() };
		playgroundState.customActions.push(newAction);
		return HttpResponse.json({ success: true, data: { id: newAction.id } });
	}),

	http.put(`${API_BASE}/custom-actions/:id`, async ({ params, request }) => {
		const id = Number(params.id);
		const body = (await request.json()) as Partial<(typeof playgroundState.customActions)[0]>;
		const action = playgroundState.customActions.find((a) => a.id === id);

		if (!action) {
			return HttpResponse.json({ success: false, error: 'Action not found' }, { status: 404 });
		}

		Object.assign(action, body);
		return HttpResponse.json({ success: true });
	}),

	http.delete(`${API_BASE}/custom-actions/:id`, ({ params }) => {
		const id = Number(params.id);
		playgroundState.customActions = playgroundState.customActions.filter((a) => a.id !== id);
		return HttpResponse.json({ success: true });
	}),

	http.post(`${API_BASE}/custom-actions/run`, () => {
		return HttpResponse.json({ success: true });
	}),

	// ==================== SECRETS (stub) ====================
	http.get(`${API_BASE}/secrets`, () => {
		return HttpResponse.json({ success: true, data: { secrets: [] } });
	}),

	// ==================== CUSTOM FIELDS (stub) ====================
	http.get(`${API_BASE}/custom-fields`, () => {
		return HttpResponse.json({ success: true, data: { fields: [] } });
	}),

	// ==================== MUTE POLICIES ====================
	http.get(`${API_BASE}/mute-policies`, () => {
		return HttpResponse.json({ success: true, data: playgroundState.mutePolicies });
	}),

	http.post(`${API_BASE}/mute-policies`, async ({ request }) => {
		const body = (await request.json()) as Partial<(typeof playgroundState.mutePolicies)[0]>;
		const newMutePolicy = {
			labelMatchers: [],
			...body,
			id: randomId(),
			createdAt: nowIso(),
			updatedAt: nowIso(),
		} as (typeof playgroundState.mutePolicies)[0];
		playgroundState.mutePolicies.unshift(newMutePolicy);
		return HttpResponse.json({ success: true, data: newMutePolicy });
	}),

	http.put(`${API_BASE}/mute-policies/:id`, async ({ params, request }) => {
		const id = Number(params.id);
		const body = (await request.json()) as Partial<(typeof playgroundState.mutePolicies)[0]>;
		const mutePolicy = playgroundState.mutePolicies.find((s) => s.id === id);
		if (!mutePolicy) {
			return HttpResponse.json({ success: false, error: 'Mute policy not found' }, { status: 404 });
		}
		Object.assign(mutePolicy, body, { updatedAt: nowIso() });
		return HttpResponse.json({ success: true, data: mutePolicy });
	}),

	http.delete(`${API_BASE}/mute-policies/:id`, ({ params }) => {
		const id = Number(params.id);
		playgroundState.mutePolicies = playgroundState.mutePolicies.filter((s) => s.id !== id);
		return HttpResponse.json({ success: true, message: 'Mute policy deleted' });
	}),

	// ==================== ACTIONS ====================
	http.get(`${API_BASE}/actions`, () => {
		return HttpResponse.json({ success: true, data: playgroundState.actions });
	}),

	http.post(`${API_BASE}/actions/test`, () => {
		return HttpResponse.json({
			success: true,
			data: { ok: true, message: 'Test sent (playground — no real call made).' },
		});
	}),

	http.post(`${API_BASE}/actions/:id/preview`, ({ params }) => {
		const id = Number(params.id);
		const action = playgroundState.actions.find((a) => a.id === id);
		if (!action) {
			return HttpResponse.json({ success: false, error: 'Action not found' }, { status: 404 });
		}
		const cfg = action.config as Record<string, string>;
		const preview =
			action.type === 'slack'
				? {
						type: 'slack',
						message: cfg.messageTemplate || 'Alert fired',
						channel: cfg.channel,
						webhookUrl: cfg.webhookUrl,
					}
				: action.type === 'teams'
					? {
							type: 'teams',
							title: cfg.titleTemplate || 'Alert',
							message: cfg.messageTemplate || 'Alert fired',
							webhookUrl: cfg.webhookUrl,
						}
					: action.type === 'jira'
						? {
								type: 'jira',
								summary: cfg.summaryTemplate || 'Alert',
								description: cfg.descriptionTemplate || '',
								baseUrl: cfg.baseUrl,
								projectKey: cfg.projectKey,
								issueType: cfg.issueType,
							}
						: { type: 'http', method: cfg.method || 'POST', url: cfg.url, body: cfg.bodyTemplate || '' };
		return HttpResponse.json({ success: true, data: preview });
	}),

	http.post(`${API_BASE}/actions/:id/run`, async ({ params, request }) => {
		const actionId = Number(params.id);
		const body = (await request.json().catch(() => ({}))) as { alert?: { id?: string } };
		const action = playgroundState.actions.find((a) => a.id === actionId);
		const alertId = body.alert?.id;
		if (alertId) {
			pushAlertEvent(alertId, {
				date: nowIso(),
				eventType: AlertHistoryEventType.ACTION_RUN,
				actorName: PLAYGROUND_ACTOR,
				description: `Ran action "${action?.name ?? 'action'}"`,
			});
		}
		return HttpResponse.json({
			success: true,
			data: { ok: true, message: 'Action sent (playground — no real call made).' },
		});
	}),

	http.post(`${API_BASE}/actions`, async ({ request }) => {
		const body = (await request.json()) as Partial<(typeof playgroundState.actions)[0]>;
		const newAction = {
			nameContains: null,
			labelMatchers: [],
			...body,
			id: randomId(),
			createdAt: nowIso(),
			updatedAt: nowIso(),
		} as (typeof playgroundState.actions)[0];
		playgroundState.actions.unshift(newAction);
		return HttpResponse.json({ success: true, data: newAction });
	}),

	http.put(`${API_BASE}/actions/:id`, async ({ params, request }) => {
		const id = Number(params.id);
		const body = (await request.json()) as Partial<(typeof playgroundState.actions)[0]>;
		const action = playgroundState.actions.find((a) => a.id === id);
		if (!action) {
			return HttpResponse.json({ success: false, error: 'Action not found' }, { status: 404 });
		}
		Object.assign(action, body, { updatedAt: nowIso() });
		return HttpResponse.json({ success: true, data: action });
	}),

	http.delete(`${API_BASE}/actions/:id`, ({ params }) => {
		const id = Number(params.id);
		playgroundState.actions = playgroundState.actions.filter((a) => a.id !== id);
		return HttpResponse.json({ success: true, message: 'Action deleted' });
	}),

	// ==================== ENRICHMENTS ====================
	http.get(`${API_BASE}/enrichments`, () => {
		return HttpResponse.json({ success: true, data: playgroundState.enrichments });
	}),

	http.post(`${API_BASE}/enrichments`, async ({ request }) => {
		const body = (await request.json()) as Partial<(typeof playgroundState.enrichments)[0]>;
		const newEnrichment = {
			labelMatchers: [],
			addFields: [],
			priority: 0,
			...body,
			id: randomId(),
			createdAt: nowIso(),
			updatedAt: nowIso(),
		} as (typeof playgroundState.enrichments)[0];
		playgroundState.enrichments.unshift(newEnrichment);
		return HttpResponse.json({ success: true, data: newEnrichment });
	}),

	http.put(`${API_BASE}/enrichments/:id`, async ({ params, request }) => {
		const id = Number(params.id);
		const body = (await request.json()) as Partial<(typeof playgroundState.enrichments)[0]>;
		const enrichment = playgroundState.enrichments.find((e) => e.id === id);
		if (!enrichment) {
			return HttpResponse.json({ success: false, error: 'Enrichment not found' }, { status: 404 });
		}
		Object.assign(enrichment, body, { updatedAt: nowIso() });
		return HttpResponse.json({ success: true, data: enrichment });
	}),

	http.delete(`${API_BASE}/enrichments/:id`, ({ params }) => {
		const id = Number(params.id);
		playgroundState.enrichments = playgroundState.enrichments.filter((e) => e.id !== id);
		return HttpResponse.json({ success: true, message: 'Enrichment deleted' });
	}),
];
