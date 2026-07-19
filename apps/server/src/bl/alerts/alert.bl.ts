import { AlertRepository } from '../../dal/alertRepository';
import { ResolvedAlertRepository } from '../../dal/resolvedAlertRepository';
import {
	Alert,
	AlertComment,
	AlertHistory,
	AlertHistoryData,
	AlertHistoryEventType,
	AlertStatus,
	AlertType,
	Logger,
	normalizeAlertSeverity,
} from '@OpsiMate/shared';
import { AlertCommentsRepository } from '../../dal/alertCommentsRepository.ts';
import { AlertHistoryRepository } from '../../dal/alertHistoryRepository';
import { UserRepository } from '../../dal/userRepository';
import { EnrichmentBL } from '../enrichments/enrichment.bl';
import { MutePolicyBL } from '../mute-policies/mutePolicy.bl';

const logger = new Logger('bl/alert.bl');

// Normalizes a timestamp to ISO-8601 UTC. SQLite CURRENT_TIMESTAMP values are
// "YYYY-MM-DD HH:MM:SS" (UTC, but without a timezone marker); already-ISO values pass through.
// Guarantees the client receives unambiguous UTC timestamps for display and time-range filtering.
const toIsoUtc = (value: string): string => {
	if (!value) return value;
	const d = value.includes('T') ? new Date(value) : new Date(value.replace(' ', 'T') + 'Z');
	return isNaN(d.getTime()) ? value : d.toISOString();
};

export class AlertBL {
	private mutePolicyBL: MutePolicyBL | null = null;
	private enrichmentBL: EnrichmentBL | null = null;

	constructor(
		private alertRepo: AlertRepository,
		private resolvedAlertRepo: ResolvedAlertRepository,
		private alertCommentsRepo: AlertCommentsRepository,
		private alertHistoryRepo: AlertHistoryRepository,
		private userRepo: UserRepository
	) {}

	// Best-effort history logging: never let a failed history write break the underlying
	// mutation (the event is informational, not transactional).
	private async recordHistoryEvent(
		alertId: string,
		eventType: AlertHistoryEventType,
		description: string,
		actorName?: string | null
	): Promise<void> {
		try {
			await this.alertHistoryRepo.recordEvent({ alertId, eventType, actorName, description });
		} catch (error) {
			logger.error(`Failed to record alert history event (${eventType}) for ${alertId}`, error);
		}
	}

	// Public hook so other modules (e.g. running an action against an alert) can append to the
	// alert's history timeline without depending on the history repository directly.
	async recordActionRun(alertId: string, actionName: string, actorName?: string | null): Promise<void> {
		await this.recordHistoryEvent(
			alertId,
			AlertHistoryEventType.ACTION_RUN,
			`Ran action "${actionName}"`,
			actorName
		);
	}

	setMutePolicyBL(mutePolicyBL: MutePolicyBL): void {
		this.mutePolicyBL = mutePolicyBL;
	}

	setEnrichmentBL(enrichmentBL: EnrichmentBL): void {
		this.enrichmentBL = enrichmentBL;
	}

	// region active
	// Severity is resolved here — the single funnel for every ingestion endpoint: an explicit
	// severity field wins, then a `severity` tag (Zabbix/Grafana/Datadog labels), then the
	// default. Free-form values are normalized onto the fixed critical/warning/info scale,
	// and the severity tag is rewritten to the normalized value so label matchers (mute policies,
	// enrichments) always see the same three values the severity field uses. The tag is
	// hidden from the UI — users only interact with the first-class severity.
	async insertOrUpdateAlert(
		alert: Omit<Alert, 'createdAt' | 'isSilenced' | 'severity'> & { severity?: string }
	): Promise<{ changes: number }> {
		try {
			logger.info(`Inserting alert: ${alert.id}`);
			// || (not ??) so a blank explicit severity falls through to the tag.
			const severity = normalizeAlertSeverity(alert.severity?.trim() || alert.tags?.['severity']);
			// Same funnel for the owning team: explicit field wins, then a `team` tag,
			// otherwise none. Unlike severity there is no fixed scale — any name is kept.
			const team = alert.team?.trim() || alert.tags?.['team'] || null;
			const tags = { ...(alert.tags ?? {}), severity };
			// The repository atomically drops any resolved copy of this id — a re-firing
			// alert must never show as both firing and resolved.
			return await this.alertRepo.insertOrUpdateAlert({ ...alert, tags, severity, team });
		} catch (error) {
			logger.error('Error inserting alert', error);
			throw error;
		}
	}

	async getAllAlerts(): Promise<Alert[]> {
		try {
			logger.info('Fetching all alerts');
			let alerts = await this.alertRepo.getAllAlerts();
			// Enrich before muting so mute policy rules can match enrichment-added tags.
			if (this.enrichmentBL) {
				alerts = await this.enrichmentBL.applyEnrichments(alerts);
			}
			if (this.mutePolicyBL) {
				return await this.mutePolicyBL.markMuted(alerts);
			}
			return alerts;
		} catch (error) {
			logger.error('Error fetching alerts', error);
			throw error;
		}
	}

	async silenceAlert(id: string, actorName?: string | null): Promise<Alert | null> {
		try {
			logger.info(`Silencing alert with id: ${id}`);
			const alert = await this.alertRepo.silenceAlert(id);
			if (alert) {
				await this.recordHistoryEvent(id, AlertHistoryEventType.SILENCED, 'Alert silenced', actorName);
			}
			return alert;
		} catch (error) {
			logger.error('Error silencing alert', error);
			throw error;
		}
	}

	async markAlertRead(id: string): Promise<Alert | null> {
		try {
			logger.info(`Marking alert as read: ${id}`);
			return await this.alertRepo.markAlertRead(id);
		} catch (error) {
			logger.error('Error marking alert as read', error);
			throw error;
		}
	}

	async unsilenceAlert(id: string, actorName?: string | null): Promise<Alert | null> {
		try {
			logger.info(`Unsilenceing alert with id: ${id}`);
			const alert = await this.alertRepo.unsilenceAlert(id);
			if (alert) {
				await this.recordHistoryEvent(id, AlertHistoryEventType.UNSILENCED, 'Alert unsilenced', actorName);
			}
			return alert;
		} catch (error) {
			logger.error('Error unsilenceing alert', error);
			throw error;
		}
	}
	// endregion

	// region resolved
	async getAllResolvedAlerts(): Promise<Alert[]> {
		try {
			logger.info('Fetching all resolved alerts');
			return await this.resolvedAlertRepo.getAllResolvedAlerts();
		} catch (error) {
			logger.error('Error fetching resolved alerts', error);
			throw error;
		}
	}

	// manualActor differentiates the two resolve flows: pass it (even with null fields) when
	// a user resolved the alert from the UI — a RESOLVED history event is recorded with their
	// name, they become the alert's owner, and an optional resolve note is stored as a
	// regular comment. Leave it undefined for API-driven resolution (a source reporting the
	// alert as recovered), which only gets the automatic status-transition entry.
	async resolveAlert(
		activeAlertId: string,
		manualActor?: { id: string | null; name: string | null },
		comment?: string
	): Promise<void> {
		try {
			logger.info(`Resolving alert with id: ${activeAlertId}`);

			// Get the active alert
			const alert = await this.alertRepo.getAlert(activeAlertId);
			if (!alert) {
				logger.warn(`Alert with id ${activeAlertId} not found, nothing to resolve`);
				return;
			}

			// Insert into resolved table
			await this.resolvedAlertRepo.insertResolvedAlert(alert);

			// Remove from active table
			await this.alertRepo.deleteAlert(activeAlertId);

			if (manualActor !== undefined) {
				await this.recordHistoryEvent(
					activeAlertId,
					AlertHistoryEventType.RESOLVED,
					'Alert resolved manually',
					manualActor.name
				);

				// Whoever resolved the alert takes ownership of it.
				if (manualActor.id != null && Number.isFinite(Number(manualActor.id))) {
					await this.resolvedAlertRepo.updateResolvedAlertOwner(activeAlertId, Number(manualActor.id));
				}

				if (comment && manualActor.id != null) {
					await this.createComment({ alertId: activeAlertId, userId: manualActor.id, comment });
				}
			}

			logger.info(`Resolved alert ${activeAlertId}`);
		} catch (error) {
			logger.error(`Error resolving alert ${activeAlertId}`, error);
			throw error;
		}
	}

	async resolveNonActiveAlerts(activeAlertIds: Set<string>, alertType: AlertType) {
		try {
			logger.info(`Resolving alerts not in ids for type: ${alertType}`);
			// Get alerts that need to be resolved
			const alertsToResolve = await this.alertRepo.getAlertsNotInIds(activeAlertIds, alertType);

			// Resolve each alert
			for (const alert of alertsToResolve) {
				await this.resolvedAlertRepo.insertResolvedAlert(alert);
			}

			// Delete alerts from active table
			await this.alertRepo.deleteAlertsNotInIds(activeAlertIds, alertType);

			logger.info(`Resolved ${alertsToResolve.length} alerts`);
		} catch (error) {
			logger.error('Error resolving alerts', error);
			throw error;
		}
	}

	// Moves a resolved alert back to the active table as firing — the reverse of resolveAlert.
	async unresolveAlert(alertId: string, actorName?: string | null): Promise<Alert | null> {
		try {
			logger.info(`Unresolving alert with id: ${alertId}`);

			const resolved = await this.resolvedAlertRepo.getResolvedAlert(alertId);
			if (!resolved) {
				logger.warn(`Resolved alert with id ${alertId} not found, nothing to unresolve`);
				return null;
			}

			const alert: Alert = {
				...resolved,
				status: AlertStatus.FIRING,
				// Resolving cleared any silence, so the alert always comes back audible.
				isSilenced: false,
				// Restored as unread (matches the is_read = 0 the repository writes) so the
				// returned alert renders with the unread treatment without waiting for a refetch.
				isRead: false,
				updatedAt: new Date().toISOString(),
			};

			await this.alertRepo.restoreAlert(alert);
			await this.resolvedAlertRepo.deleteResolvedAlert(alertId);
			await this.recordHistoryEvent(
				alertId,
				AlertHistoryEventType.UNRESOLVED,
				'Alert moved back to firing',
				actorName
			);

			logger.info(`Unresolved alert ${alertId}`);
			return alert;
		} catch (error) {
			logger.error(`Error unresolving alert ${alertId}`, error);
			throw error;
		}
	}

	async deleteResolvedAlert(alertId: string): Promise<void> {
		try {
			logger.info(`Permanently deleting resolved alert with id: ${alertId}`);
			await this.resolvedAlertRepo.deleteResolvedAlert(alertId);
		} catch (error) {
			logger.error('Error deleting resolved alert', error);
			throw error;
		}
	}
	// endregion

	// region history
	async getAlertHistory(alertId: string): Promise<AlertHistory> {
		// Merge two sources: automatic status transitions (trigger-populated) and user-driven
		// events (ownership, silencings, actions, comments), newest first.
		const [statusHistory, events] = await Promise.all([
			this.resolvedAlertRepo.getAlertHistory(alertId),
			this.alertHistoryRepo.getEvents(alertId),
		]);

		const eventEntries: AlertHistoryData[] = events.map((row) => ({
			date: toIsoUtc(row.created_at),
			eventType: row.event_type as AlertHistoryEventType,
			actorName: row.actor_name ?? undefined,
			description: row.description ?? undefined,
		}));

		// A manual resolve records a RESOLVED event (with the acting user) AND fires the
		// automatic status trigger. Suppress the trigger's entry when a manual-resolve event
		// sits right next to it, so the timeline shows one entry per resolve — with the actor
		// for manual resolves, without one for API/source-driven resolution.
		const manualResolveTimes = eventEntries
			.filter((e) => e.eventType === AlertHistoryEventType.RESOLVED)
			.map((e) => new Date(e.date).getTime());
		const coveredByManualResolve = (entry: { date: string; status?: AlertStatus }): boolean =>
			entry.status !== AlertStatus.FIRING &&
			manualResolveTimes.some((t) => Math.abs(t - new Date(toIsoUtc(entry.date)).getTime()) < 10_000);

		const statusEntries: AlertHistoryData[] = statusHistory.data
			.filter((entry) => !coveredByManualResolve(entry))
			.map((entry) => ({
				...entry,
				date: toIsoUtc(entry.date),
				eventType: AlertHistoryEventType.STATUS_CHANGED,
				description: entry.status === AlertStatus.FIRING ? 'Alert started firing' : 'Alert resolved',
			}));

		const data = [...statusEntries, ...eventEntries].sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
		);

		return { alertId, data };
	}
	// endregion

	// region owner
	async setAlertOwner(
		alertId: string,
		ownerId: string | null,
		isResolved: boolean,
		actorName?: string | null
	): Promise<Alert | null> {
		try {
			logger.info(`Setting owner ${ownerId} for alert: ${alertId} is Resolved ${isResolved}`);
			// Convert string to number for database storage
			const numericOwnerId = ownerId !== null ? parseInt(ownerId, 10) : null;
			const updated = isResolved
				? await this.resolvedAlertRepo.updateResolvedAlertOwner(alertId, numericOwnerId)
				: await this.alertRepo.updateAlertOwner(alertId, numericOwnerId);

			if (updated) {
				if (numericOwnerId !== null) {
					const owner = await this.userRepo.getUserById(numericOwnerId).catch(() => null);
					const ownerName = owner?.fullName ?? `user #${numericOwnerId}`;
					await this.recordHistoryEvent(
						alertId,
						AlertHistoryEventType.OWNER_ASSIGNED,
						`Assigned to ${ownerName}`,
						actorName
					);
				} else {
					await this.recordHistoryEvent(
						alertId,
						AlertHistoryEventType.OWNER_UNASSIGNED,
						'Owner removed',
						actorName
					);
				}
			}
			return updated;
		} catch (error) {
			logger.error('Error setting alert owner', error);
			throw error;
		}
	}
	// endregion

	// region comments
	// Comments are intentionally NOT recorded in the alert history timeline (they live in their
	// own Comments tab), to keep the history focused on status/ownership/action events.
	async createComment(comment: Omit<AlertComment, 'createdAt' | 'updatedAt' | 'id'>): Promise<AlertComment> {
		return this.alertCommentsRepo.createComment(comment);
	}

	async updateComment(id: string, userId: string, comment: string): Promise<AlertComment | null> {
		return await this.alertCommentsRepo.updateComment(id, userId, comment);
	}

	async deleteComment(id: string, userId: string): Promise<void> {
		return await this.alertCommentsRepo.deleteComment(id, userId);
	}

	async getCommentsByAlertId(alertId: string): Promise<AlertComment[]> {
		return await this.alertCommentsRepo.getCommentsByAlertId(alertId);
	}
	// endregion
}
