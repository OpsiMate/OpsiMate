import { AlertStatus } from '@OpsiMate/shared';
import { http, HttpResponse } from 'msw';
import { getPlaygroundUser, playgroundState, randomId } from './state';

const API_BASE = '*/api/v1';
const nowIso = () => new Date().toISOString();

export const handlers = [
	// ==================== ALERTS ====================
	http.get(`${API_BASE}/alerts`, () => {
		return HttpResponse.json({
			success: true,
			data: { alerts: playgroundState.alerts },
		});
	}),

	http.get(`${API_BASE}/alerts/archived`, () => {
		return HttpResponse.json({
			success: true,
			data: { alerts: playgroundState.archivedAlerts },
		});
	}),

	http.patch(`${API_BASE}/alerts/:alertId/dismiss`, ({ params }) => {
		const alertId = params.alertId as string;
		const alert = playgroundState.alerts.find((a) => a.id === alertId);

		if (!alert) {
			return HttpResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
		}

		alert.isDismissed = true;
		alert.updatedAt = nowIso();

		return HttpResponse.json({ success: true, data: { alert } });
	}),

	http.patch(`${API_BASE}/alerts/:alertId/undismiss`, ({ params }) => {
		const alertId = params.alertId as string;
		const alert = playgroundState.alerts.find((a) => a.id === alertId);

		if (!alert) {
			return HttpResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
		}

		alert.isDismissed = false;
		alert.updatedAt = nowIso();

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

		return HttpResponse.json({ success: true, data: { alert } });
	}),

	http.patch(`${API_BASE}/alerts/archived/:alertId/owner`, async ({ params, request }) => {
		const alertId = params.alertId as string;
		const body = (await request.json()) as { ownerId: string | null };
		const alert = playgroundState.archivedAlerts.find((a) => a.id === alertId);

		if (!alert) {
			return HttpResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
		}

		alert.ownerId = body.ownerId;
		alert.updatedAt = nowIso();

		return HttpResponse.json({ success: true, data: { alert } });
	}),

	http.delete(`${API_BASE}/alerts/:alertId`, ({ params }) => {
		const alertId = params.alertId as string;
		const alertIndex = playgroundState.alerts.findIndex((a) => a.id === alertId);

		if (alertIndex === -1) {
			return HttpResponse.json({ success: true, message: 'Alert not found, nothing to archive' });
		}

		const alert = { ...playgroundState.alerts[alertIndex] };
		alert.status = AlertStatus.RESOLVED;
		alert.updatedAt = nowIso();

		playgroundState.alerts.splice(alertIndex, 1);
		playgroundState.archivedAlerts.unshift(alert);

		return HttpResponse.json({ success: true, message: 'Alert deleted successfully' });
	}),

	http.delete(`${API_BASE}/alerts/archived/:alertId`, ({ params }) => {
		const alertId = params.alertId as string;
		playgroundState.archivedAlerts = playgroundState.archivedAlerts.filter((a) => a.id !== alertId);
		return HttpResponse.json({ success: true });
	}),

	http.get(`${API_BASE}/alerts/:alertId/history`, ({ params }) => {
		const alertId = params.alertId as string;
		const now = Date.now();
		const history = {
			alertId,
			data: Array.from({ length: 6 }).map((_, idx) => ({
				date: new Date(now - idx * 60 * 60 * 1000).toISOString(),
				status: idx % 2 === 0 ? AlertStatus.FIRING : AlertStatus.RESOLVED,
			})),
		};
		return HttpResponse.json({ success: true, data: history });
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
		return HttpResponse.json({ success: true, data: { message: 'Deleted' } });
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
		return HttpResponse.json({ success: true, data: { tag: newTag } });
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
		const body = await request.json();
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
];
