import { Router } from 'express';
import { OncallController } from './controller';
import { requireAdmin } from '../../../middleware/auth';

export default function createOncallRouter(controller: OncallController) {
	const router = Router();

	// Reading the schedule is open to any authenticated user (the NOC needs it);
	// changing it is admins only.
	router.get('/teams', controller.listTeamsHandler);
	router.post('/teams', requireAdmin, controller.createTeamHandler);
	router.patch('/teams/:teamId', requireAdmin, controller.updateTeamHandler);
	router.delete('/teams/:teamId', requireAdmin, controller.deleteTeamHandler);
	router.put('/teams/:teamId/members', requireAdmin, controller.setTeamMembersHandler);

	return router;
}
