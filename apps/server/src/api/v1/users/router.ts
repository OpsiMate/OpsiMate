import { Router } from 'express';
import { UsersController } from './controller';
import { requireAdmin } from '../../../middleware/auth';

export default function createUsersRouter(usersController: UsersController) {
	const router = Router();

	// POST /users - admin creates new user
	router.post('/', requireAdmin, usersController.createUserHandler);

	// GET /users - list users. Deliberately NOT admin-gated: the alerts UI resolves
	// owner and comment-author names for every authenticated role.
	router.get('/', usersController.getAllUsersHandler);

	// PATCH /users/role - update user role
	router.patch('/role', requireAdmin, usersController.updateUserRoleHandler);

	// GET /users/profile - get user profile
	router.get('/profile', usersController.getProfileHandler);

	// PATCH /users/profile - update user profile
	router.patch('/profile', usersController.updateProfileHandler);

	// DELETE /users/:id - delete user by ID (admin only)
	router.delete('/:id', requireAdmin, usersController.deleteUserHandler);

	// PATCH /users/password - update user password
	router.patch('/:id/reset-password', requireAdmin, usersController.updateUserPasswordHandler);

	//PATCH /user/:id - update user info by admin
	router.patch('/:id', requireAdmin, usersController.updateUserHandler);

	return router;
}
