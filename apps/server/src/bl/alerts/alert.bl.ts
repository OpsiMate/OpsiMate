import { AlertRepository } from '../../dal/alertRepository';
import { AlertRow } from '../../dal/models';
import { Alert, Logger } from '@OpsiMate/shared';

const logger = new Logger('bl/alert.bl');

export class AlertBL {
	constructor(private alertRepo: AlertRepository) {}

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

}
