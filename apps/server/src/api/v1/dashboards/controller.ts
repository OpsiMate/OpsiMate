import { Request, Response } from 'express';
import { CreateDashboardSchema, DashboardIdSchema, DashboardTagSchema, Logger } from '@OpsiMate/shared';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { isZodError } from '../../../utils/isZodError.ts';
import { DashboardBL } from '../../../bl/dashboards/dashboard.bl.ts';
import { TagRepository } from '../../../dal/tagRepository';

const logger = new Logger('api/v1/dashboards/controller');

export class DashboardController {
	constructor(
		private dashboardBL: DashboardBL,
		private tagRepo?: TagRepository
	) {}

	getDashboardsHandler = async (req: Request, res: Response) => {
		try {
			const dashboards = await this.dashboardBL.getAllDashboards();
			return res.json({ success: true, data: dashboards });
		} catch (error) {
			logger.error('Error getting dashboards:', error);
			return res.status(500).json({ success: false, error: 'Failed to get dashboards' });
		}
	};

	createDashboardHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const user = req.user;

			if (!user) {
				return res.status(401).json({ success: false, error: 'Unauthorized: user not found' });
			}

			const createDashboardRequest = CreateDashboardSchema.parse(req.body);
			const createdDashboardId = await this.dashboardBL.createDashboard(createDashboardRequest, user);

			return res.json({ success: true, data: { id: createdDashboardId } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error saving dashboard:', error);
			const message = error instanceof Error ? error.message : String(error);
			return res.status(500).json({
				success: false,
				error: message || 'Failed to save dashboard',
			});
		}
	};

	updateDashboardHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const user = req.user;

			if (!user) {
				return res.status(401).json({ success: false, error: 'Unauthorized: user not found' });
			}

			const dashboardId = req.params.dashboardId;
			const updateDashboardRequest = CreateDashboardSchema.parse(req.body);
			await this.dashboardBL.updateDashboard(dashboardId, updateDashboardRequest, user);

			return res.json({ success: true, data: null });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error Updating dashboard:', error);
			const message = error instanceof Error ? error.message : String(error);
			return res.status(500).json({
				success: false,
				error: message || 'Failed to update dashboard',
			});
		}
	};

	deleteDashboardHandler = async (req: Request, res: Response) => {
		try {
			const dashboardId = req.params.dashboardId;
			const success = await this.dashboardBL.deleteDashboard(dashboardId);

			if (!success) {
				return res.status(404).json({ success: false, error: 'dashboard not found or could not be deleted' });
			}

			return res.json({ success: true, message: 'dashboards deleted successfully' });
		} catch (error) {
			logger.error('Error deleting dashboards:', error);
			const message = error instanceof Error ? error.message : String(error);
			return res.status(500).json({ success: false, error: message || 'Failed to delete dashboard' });
		}
	};

	getDashboardTagsHandler = async (req: Request, res: Response) => {
		try {
			if (!this.tagRepo) {
				return res.status(500).json({ success: false, error: 'Tag repository not configured' });
			}

			const { dashboardId } = DashboardIdSchema.parse({ dashboardId: req.params.dashboardId });

			const tags = await this.tagRepo.getDashboardTags(dashboardId);
			return res.json({ success: true, data: tags });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error getting dashboard tags:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	getAllDashboardTagsHandler = async (req: Request, res: Response) => {
		try {
			if (!this.tagRepo) {
				return res.status(500).json({ success: false, error: 'Tag repository not configured' });
			}

			const dashboardTags = await this.tagRepo.getAllDashboardTags();
			return res.json({ success: true, data: dashboardTags });
		} catch (error) {
			logger.error('Error getting all dashboard tags:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	addTagToDashboardHandler = async (req: Request, res: Response) => {
		try {
			if (!this.tagRepo) {
				return res.status(500).json({ success: false, error: 'Tag repository not configured' });
			}

			const { dashboardId } = req.params;
			const { tagId } = req.body as { tagId: number };
			const parsed = DashboardTagSchema.parse({
				dashboardId: Number(dashboardId),
				tagId,
			});

			const dashboard = await this.dashboardBL.getDashboardById(String(parsed.dashboardId));
			if (!dashboard) {
				return res.status(404).json({ success: false, error: 'Dashboard not found' });
			}

			const tag = await this.tagRepo.getTagById(parsed.tagId);
			if (!tag) {
				return res.status(404).json({ success: false, error: 'Tag not found' });
			}

			await this.tagRepo.addTagToDashboard(parsed.dashboardId, parsed.tagId);
			return res.json({ success: true, message: 'Tag added to dashboard successfully' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error adding tag to dashboard:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	removeTagFromDashboardHandler = async (req: Request, res: Response) => {
		try {
			if (!this.tagRepo) {
				return res.status(500).json({ success: false, error: 'Tag repository not configured' });
			}

			const { dashboardId, tagId } = req.params;
			const parsed = DashboardTagSchema.parse({
				dashboardId: Number(dashboardId),
				tagId: Number(tagId),
			});

			const tag = await this.tagRepo.getTagById(parsed.tagId);
			if (!tag) {
				return res.status(404).json({ success: false, error: 'Tag not found' });
			}

			await this.tagRepo.removeTagFromDashboard(parsed.dashboardId, parsed.tagId);
			return res.json({ success: true, message: 'Tag removed from dashboard successfully' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error removing tag from dashboard:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
