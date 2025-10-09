import { Request, Response } from "express";
import { Logger } from "@OpsiMate/shared";
import { AlertBL } from "../../../bl/alerts/alert.bl";

const logger: Logger = new Logger('server');

export class AlertController {
    constructor(private alertBL: AlertBL) {}

    async getAlerts(req: Request, res: Response) {
        try {
            const alerts = await this.alertBL.getAllAlerts();
            return res.json({ success: true, data: { alerts } });
        } catch (error) {
            logger.error('Error getting alerts:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    async dismissAlert(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'Alert id is required' });
            }
            const alert = await this.alertBL.dismissAlert(id);
            if (!alert) {
                return res.status(404).json({ success: false, error: 'Alert not found' });
            }
            return res.json({ success: true, data: { alert } });
        } catch (error) {
            logger.error('Error dismissing alert:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    async undismissAlert(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'Alert id is required' });
            }
            const alert = await this.alertBL.undismissAlert(id);
            if (!alert) {
                return res.status(404).json({ success: false, error: 'Alert not found' });
            }
            return res.json({ success: true, data: { alert } });
        } catch (error) {
            logger.error('Error undismissing alert:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
} 