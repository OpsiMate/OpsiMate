import { AlertRepository } from '../../dal/alertRepository';
import { ArchivedAlertRepository } from '../../dal/archivedAlertRepository';
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
import { SilenceBL } from '../silences/silence.bl';

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
	private silenceBL: SilenceBL | null = null;
	private enrichmentBL: EnrichmentBL | null = null;

	constructor(
		private alertRepo: AlertRepository,
		private archivedAlertRepo: ArchivedAlertRepository,
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

	setSilenceBL(silenceBL: SilenceBL): void {
		this.silenceBL = silenceBL;
	}

	setEnrichmentBL(enrichmentBL: EnrichmentBL): void {
		this.enrichmentBL = enrichmentBL;
	}

	// region active
	// Severity is resolved here — the single funnel for every ingestion endpoint: an explicit
	// severity field wins, then a `severity` tag (Zabbix/Grafana/Datadog labels), then the
	// default. Free-form values are normalized onto the fixed critical/warning/info scale.
	async insertOrUpdateAlert(
		alert: Omit<Alert, 'createdAt' | 'isDismissed' | 'severity'> & { severity?: string }
	): Promise<{ changes: number }> {
		try {
			logger.info(`Inserting alert: ${alert.id}`);
			const severity = normalizeAlertSeverity(alert.severity ?? alert.tags?.['severity']);
			return await this.alertRepo.insertOrUpdateAlert({ ...alert, severity });
		} catch (error) {
			logger.error('Error inserting alert', error);
			throw error;
		}
	}

	async getAllAlerts(): Promise<Alert[]> {
		try {
			logger.info('Fetching all alerts');
			let alerts = await this.alertRepo.getAllAlerts();
			// Enrich before silencing so silence rules can match enrichment-added tags.
			if (this.enrichmentBL) {
				alerts = await this.enrichmentBL.applyEnrichments(alerts);
			}
			if (this.silenceBL) {
				return await this.silenceBL.markSilenced(alerts);
			}
			return alerts;
		} catch (error) {
			logger.error('Error fetching alerts', error);
			throw error;
		}
	}

	async dismissAlert(id: string, actorName?: string | null): Promise<Alert | null> {
		try {
			logger.info(`Dismissing alert with id: ${id}`);
			const alert = await this.alertRepo.dismissAlert(id);
			if (alert) {
				await this.recordHistoryEvent(id, AlertHistoryEventType.DISMISSED, 'Alert dismissed', actorName);
			}
			return alert;
		} catch (error) {
			logger.error('Error dismissing alert', error);
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

	async undismissAlert(id: string, actorName?: string | null): Promise<Alert | null> {
		try {
			logger.info(`Undismissing alert with id: ${id}`);
			const alert = await this.alertRepo.undismissAlert(id);
			if (alert) {
				await this.recordHistoryEvent(id, AlertHistoryEventType.UNDISMISSED, 'Alert restored', actorName);
			}
			return alert;
		} catch (error) {
			logger.error('Error undismissing alert', error);
			throw error;
		}
	}
	// endregion

	// region archived
	async getAllArchivedAlerts(): Promise<Alert[]> {
		try {
			logger.info('Fetching all archived alerts');
			return await this.archivedAlertRepo.getAllArchivedAlerts();
		} catch (error) {
			logger.error('Error fetching archived alerts', error);
			throw error;
		}
	}

	async archiveAlert(activeAlertId: string): Promise<void> {
		try {
			logger.info(`Archiving alert with id: ${activeAlertId}`);

			// Get the active alert
			const alert = await this.alertRepo.getAlert(activeAlertId);
			if (!alert) {
				logger.warn(`Alert with id ${activeAlertId} not found, nothing to archive`);
				return;
			}

			// Insert into archived table
			await this.archivedAlertRepo.insertArchivedAlert(alert);

			// Remove from active table
			await this.alertRepo.deleteAlert(activeAlertId);

			logger.info(`Archived alert ${activeAlertId}`);
		} catch (error) {
			logger.error(`Error archiving alert ${activeAlertId}`, error);
			throw error;
		}
	}

	async archiveNonActiveAlerts(activeAlertIds: Set<string>, alertType: AlertType) {
		try {
			logger.info(`Archiving alerts not in ids for type: ${alertType}`);
			// Get alerts that need to be archived
			const alertsToArchive = await this.alertRepo.getAlertsNotInIds(activeAlertIds, alertType);

			// Archive each alert
			for (const alert of alertsToArchive) {
				await this.archivedAlertRepo.insertArchivedAlert(alert);
			}

			// Delete alerts from active table
			await this.alertRepo.deleteAlertsNotInIds(activeAlertIds, alertType);

			logger.info(`Archived ${alertsToArchive.length} alerts`);
		} catch (error) {
			logger.error('Error archiving alerts', error);
			throw error;
		}
	}

	async deleteArchivedAlert(alertId: string): Promise<void> {
		try {
			logger.info(`Permanently deleting archived alert with id: ${alertId}`);
			await this.archivedAlertRepo.deleteArchivedAlert(alertId);
		} catch (error) {
			logger.error('Error deleting archived alert', error);
			throw error;
		}
	}
	// endregion

	// region history
	async getAlertHistory(alertId: string): Promise<AlertHistory> {
		// Merge two sources: automatic status transitions (trigger-populated) and user-driven
		// events (ownership, dismissals, actions, comments), newest first.
		const [statusHistory, events] = await Promise.all([
			this.archivedAlertRepo.getAlertHistory(alertId),
			this.alertHistoryRepo.getEvents(alertId),
		]);

		const statusEntries: AlertHistoryData[] = statusHistory.data.map((entry) => ({
			...entry,
			date: toIsoUtc(entry.date),
			eventType: AlertHistoryEventType.STATUS_CHANGED,
			description: entry.status === AlertStatus.FIRING ? 'Alert started firing' : 'Alert resolved',
		}));

		const eventEntries: AlertHistoryData[] = events.map((row) => ({
			date: toIsoUtc(row.created_at),
			eventType: row.event_type as AlertHistoryEventType,
			actorName: row.actor_name ?? undefined,
			description: row.description ?? undefined,
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
		isArchived: boolean,
		actorName?: string | null
	): Promise<Alert | null> {
		try {
			logger.info(`Setting owner ${ownerId} for alert: ${alertId} is Archived ${isArchived}`);
			// Convert string to number for database storage
			const numericOwnerId = ownerId !== null ? parseInt(ownerId, 10) : null;
			const updated = isArchived
				? await this.archivedAlertRepo.updateArchivedAlertOwner(alertId, numericOwnerId)
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
