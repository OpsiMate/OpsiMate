import {
	CreateIncidentSchema,
	IncidentAlertIdsSchema,
	IncidentIdSchema,
	Logger,
	UpdateIncidentSchema,
} from '@OpsiMate/shared';
import { Response } from 'express';
import { IncidentActor, IncidentBL } from '../../../bl/incidents/incident.bl';
import { AuthenticatedRequest } from '../../../middleware/auth.ts';
import { isZodError } from '../../../utils/isZodError';

const logger = new Logger('api/v1/incidents/controller');

const actorFrom = (req: AuthenticatedRequest): IncidentActor => ({
	id: req.user != null ? req.user.id : null,
	name: req.user?.fullName ?? null,
});

export class IncidentController {
	constructor(private incidentBL: IncidentBL) {}

	listHandler = async (_req: AuthenticatedRequest, res: Response) => {
		try {
			const incidents = await this.incidentBL.list();
			return res.json({ success: true, data: incidents });
		} catch (error) {
			logger.error('Error listing incidents', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	getHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { incidentId } = IncidentIdSchema.parse({ incidentId: req.params.incidentId });
			const incident = await this.incidentBL.get(incidentId);
			if (!incident) {
				return res.status(404).json({ success: false, error: 'Incident not found' });
			}
			return res.json({ success: true, data: incident });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error getting incident', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	createHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const data = CreateIncidentSchema.parse(req.body);
			const incident = await this.incidentBL.create(data, actorFrom(req));
			return res.status(201).json({ success: true, data: incident, message: 'Incident created' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error creating incident', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updateHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { incidentId } = IncidentIdSchema.parse({ incidentId: req.params.incidentId });
			const data = UpdateIncidentSchema.parse(req.body);
			const updated = await this.incidentBL.update(incidentId, data);
			if (!updated) {
				return res.status(404).json({ success: false, error: 'Incident not found' });
			}
			return res.json({ success: true, data: updated, message: 'Incident updated' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error updating incident', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	addAlertsHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { incidentId } = IncidentIdSchema.parse({ incidentId: req.params.incidentId });
			const { alertIds } = IncidentAlertIdsSchema.parse(req.body);
			const summary = await this.incidentBL.addAlerts(incidentId, alertIds, actorFrom(req));
			if (!summary) {
				return res.status(404).json({ success: false, error: 'Incident not found' });
			}
			return res.json({ success: true, data: summary, message: 'Alerts added to incident' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error adding alerts to incident', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	removeAlertsHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { incidentId } = IncidentIdSchema.parse({ incidentId: req.params.incidentId });
			const { alertIds } = IncidentAlertIdsSchema.parse(req.body);
			const result = await this.incidentBL.removeAlerts(incidentId, alertIds, actorFrom(req));
			if (!result) {
				return res.status(404).json({ success: false, error: 'Incident not found' });
			}
			return res.json({
				success: true,
				data: result,
				message: result.dissolved ? 'Incident dissolved (no members left)' : 'Alerts removed from incident',
			});
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error removing alerts from incident', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	deleteHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { incidentId } = IncidentIdSchema.parse({ incidentId: req.params.incidentId });
			const deleted = await this.incidentBL.delete(incidentId, actorFrom(req));
			if (!deleted) {
				return res.status(404).json({ success: false, error: 'Incident not found' });
			}
			return res.json({ success: true, message: 'Incident ungrouped' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error deleting incident', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
