import { Request, Response } from 'express';
import {
	AlertEnrichmentIdSchema,
	CreateAlertEnrichmentSchema,
	Logger,
	UpdateAlertEnrichmentSchema,
} from '@OpsiMate/shared';
import { EnrichmentBL } from '../../../bl/enrichments/enrichment.bl';
import { AuthenticatedRequest } from '../../../middleware/auth.ts';
import { isZodError } from '../../../utils/isZodError';

const logger = new Logger('api/v1/enrichments/controller');

export class EnrichmentController {
	constructor(private enrichmentBL: EnrichmentBL) {}

	listHandler = async (_req: Request, res: Response) => {
		try {
			const enrichments = await this.enrichmentBL.list();
			return res.json({ success: true, data: enrichments });
		} catch (error) {
			logger.error('Error listing enrichments', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	getHandler = async (req: Request, res: Response) => {
		try {
			const { enrichmentId } = AlertEnrichmentIdSchema.parse({ enrichmentId: req.params.enrichmentId });
			const enrichment = await this.enrichmentBL.get(enrichmentId);
			if (!enrichment) {
				return res.status(404).json({ success: false, error: 'Enrichment not found' });
			}
			return res.json({ success: true, data: enrichment });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error getting enrichment', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	createHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const data = CreateAlertEnrichmentSchema.parse(req.body as unknown);
			const enrichment = await this.enrichmentBL.create(
				{
					name: data.name,
					nameContains: data.nameContains ?? null,
					labelMatchers: data.labelMatchers ?? [],
					addFields: data.addFields ?? [],
					summaryTemplate: data.summaryTemplate ?? null,
					priority: data.priority ?? 0,
				},
				req.user?.fullName
			);
			return res.status(201).json({ success: true, data: enrichment, message: 'Enrichment created' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error creating enrichment', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updateHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { enrichmentId } = AlertEnrichmentIdSchema.parse({ enrichmentId: req.params.enrichmentId });
			const data = UpdateAlertEnrichmentSchema.parse(req.body as unknown);

			const existing = await this.enrichmentBL.get(enrichmentId);
			if (!existing) {
				return res.status(404).json({ success: false, error: 'Enrichment not found' });
			}

			const updated = await this.enrichmentBL.update(enrichmentId, data, req.user?.fullName);
			return res.json({ success: true, data: updated, message: 'Enrichment updated' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error updating enrichment', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	deleteHandler = async (req: Request, res: Response) => {
		try {
			const { enrichmentId } = AlertEnrichmentIdSchema.parse({ enrichmentId: req.params.enrichmentId });
			const existing = await this.enrichmentBL.get(enrichmentId);
			if (!existing) {
				return res.status(404).json({ success: false, error: 'Enrichment not found' });
			}
			await this.enrichmentBL.delete(enrichmentId);
			return res.json({ success: true, message: 'Enrichment deleted' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error deleting enrichment', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
