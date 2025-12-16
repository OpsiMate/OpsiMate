import { AlertRepository } from '../../dal/alertRepository';
import { ArchivedAlertRepository } from '../../dal/archivedAlertRepository';
import { Alert, AlertHistory, AlertType, Logger } from '@OpsiMate/shared';

const logger = new Logger('bl/alert.bl');

export class AlertBL {
	constructor(
		private alertRepo: AlertRepository,
		private archivedAlertRepo: ArchivedAlertRepository
	) {}

	// region active
	async insertOrUpdateAlert(alert: Omit<Alert, 'createdAt' | 'isDismissed'>): Promise<{ changes: number }> {
		try {
			logger.info(`Inserting alert: ${alert.id}`);
			return await this.alertRepo.insertOrUpdateAlert(alert);
		} catch (error) {
			logger.error('Error inserting alert', error);
			throw error;
		}
	}

	async getAllAlerts(): Promise<Alert[]> {
		try {
			logger.info('Fetching all alerts');
			return await this.alertRepo.getAllAlerts();
		} catch (error) {
			logger.error('Error fetching alerts', error);
			throw error;
		}
	}

	async dismissAlert(id: string): Promise<Alert | null> {
		try {
			logger.info(`Dismissing alert with id: ${id}`);
			return await this.alertRepo.dismissAlert(id);
		} catch (error) {
			logger.error('Error dismissing alert', error);
			throw error;
		}
	}

	async undismissAlert(id: string): Promise<Alert | null> {
		try {
			logger.info(`Undismissing alert with id: ${id}`);
			return await this.alertRepo.undismissAlert(id);
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
		return await this.archivedAlertRepo.getAlertHistory(alertId);
	}
	// endregion

	// region owner
	async setAlertOwner(alertId: string, ownerId: number | null): Promise<Alert | null> {
		try {
			logger.info(`Setting owner ${ownerId} for alert: ${alertId}`);
			return await this.alertRepo.updateAlertOwner(alertId, ownerId);
		} catch (error) {
			logger.error('Error setting alert owner', error);
			throw error;
		}
	}
	// endregion
}
