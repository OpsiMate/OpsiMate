/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { OncallController } from './controller';

export default function createOncallRouter(controller: OncallController) {
	const router = PromiseRouter();

	router.get('/teams', controller.listTeamsHandler);
	router.post('/teams', controller.createTeamHandler);
	router.patch('/teams/:teamId', controller.updateTeamHandler);
	router.delete('/teams/:teamId', controller.deleteTeamHandler);
	router.put('/teams/:teamId/members', controller.setTeamMembersHandler);

	return router;
}
