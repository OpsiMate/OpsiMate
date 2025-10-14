import { AlertRepository } from "../../dal/alertRepository.js";
import { AlertRow } from "../../dal/models.js";
import {Alert, Logger} from "@OpsiMate/shared";

const logger = new Logger('bl/alert.bl');

export class AlertBL {
    constructor(private alertRepo: AlertRepository) {}

    async insertOrUpdateAlert(alert: Omit<AlertRow, 'created_at' | 'is_dismissed'>): Promise<{ changes: number }> {
        try {
            logger.info(`Inserting alert: ${JSON.stringify(alert)}`);
            return await this.alertRepo.insertOrUpdateAlert(alert);
        } catch (error) {
            logger.error("Error inserting alert", error);
            throw error;
        }
    }

    async deleteAlertsNotInIds(ids: string[]): Promise<{ changes: number }> {
        try {
            logger.info(`deleting all alerts except of: ${JSON.stringify(ids)}`);
            return await this.alertRepo.deleteAlertsNotInIds(ids);
        } catch (error) {
            logger.error("Error deleting alerts", error);
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

    async clearAlertsByTag(tag: string): Promise<{ changes: number }> {
  try {
    logger.info(`Clearing alerts by tag: "${tag}"`);
    const res = await this.alertRepo.deleteAlertsByTag(tag);
    logger.info(`Cleared ${res.changes} alert(s) by tag: "${tag}"`);
    return res;
  } catch (error) {
    logger.error(`Error clearing alerts by tag: "${tag}"`, error);
    throw error;
  }
}

async clearAlertsByService(serviceId: number): Promise<{ changes: number }> {
  try {
    logger.info(`Clearing alerts by serviceId: ${serviceId}`);
    const res = await this.alertRepo.deleteAlertsByService(serviceId);
    logger.info(`Cleared ${res.changes} alert(s) for serviceId: ${serviceId}`);
    return res;
  } catch (error) {
    logger.error(`Error clearing alerts by serviceId: ${serviceId}`, error);
    throw error;
  }
}
async clearAlertsByServiceAndTag(serviceId: number, tag: string): Promise<{ changes: number }> {
  try {
    logger.info(`Clearing alerts by serviceId=${serviceId} & tag="${tag}"`);
    const res = await this.alertRepo.deleteAlertsByServiceAndTag(serviceId, tag);
    logger.info(`Cleared ${res.changes} alert(s) for serviceId=${serviceId} & tag="${tag}"`);
    return res;
  } catch (error) {
    logger.error(`Error clearing alerts by serviceId=${serviceId} & tag="${tag}"`, error);
    throw error;
  }
}
}