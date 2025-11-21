import { AlertRepository } from '../../dal/alertRepository';
import { ArchivedAlertRepository } from '../../dal/archivedAlertRepository';
import { AlertRow } from '../../dal/models';
import { Alert, AlertType, Logger } from '@OpsiMate/shared';

const logger = new Logger('bl/alert.bl');

export class AlertBL {
	constructor(
		private alertRepo: AlertRepository,
		private archivedAlertRepo: ArchivedAlertRepository
	) {}

	async insertOrUpdateAlert(alert: Omit<AlertRow, 'created_at' | 'is_dismissed'>): Promise<{ changes: number }> {
		try {
			logger.info(`Inserting alert: ${JSON.stringify(alert)}`);
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

	async archiveAlertsNotInIds(activeAlertIds: Set<string>, alertType: AlertType): Promise<void> {
		try {
			logger.info(`Archiving alerts not in ids for type: ${alertType}`);
			// Get alerts that need to be archived
			const alertsToArchive = await this.alertRepo.getAlertsNotInIds(activeAlertIds, alertType);
			
			// Archive each alert
			for (const alert of alertsToArchive) {
				await this.archivedAlertRepo.insertArchivedAlert({
					...alert,
					archived_at: new Date().toISOString(),
				});
			}

			// Delete alerts from active table
			await this.alertRepo.deleteAlertsNotInIds(activeAlertIds, alertType);
			
			logger.info(`Archived ${alertsToArchive.length} alerts`);
		} catch (error) {
			logger.error('Error archiving alerts', error);
			throw error;
		}
	}

	async deleteAlertsNotInIds(activeAlertIds: Set<string>, alertType: AlertType) {
		await this.archiveAlertsNotInIds(activeAlertIds, alertType);
	}

	async deleteAlert(alertId: string): Promise<void> {
		try {
			logger.info(`Deleting alert with id: ${alertId}`);
			await this.alertRepo.deleteAlert(alertId);
		} catch (error) {
			logger.error('Error deleting alert', error);
			throw error;
		}
	}

	async getAllArchivedAlerts(): Promise<Alert[]> {
		try {
			logger.info('Fetching all archived alerts');
			return await this.archivedAlertRepo.getAllArchivedAlerts();
		} catch (error) {
			logger.error('Error fetching archived alerts', error);
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
}
