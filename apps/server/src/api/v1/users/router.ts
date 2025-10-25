/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { UsersController } from './controller';

export default function createUsersRouter(usersController: UsersController) {
	const router = PromiseRouter();

	// POST /users - admin creates new user
	router.post('/', usersController.createUserHandler);

	// GET /users - get all users (admin only)
	router.get('/', usersController.getAllUsersHandler);

	// PATCH /users/role - update user role
	router.patch('/role', usersController.updateUserRoleHandler);

	// GET /users/profile - get user profile
	router.get('/profile', usersController.getProfileHandler);

	// PATCH /users/profile - update user profile
	router.patch('/profile', usersController.updateProfileHandler);

	// GET /users/email-status - check if email functionality is enabled
	router.get('/email-status', usersController.emailStatusHandler);

	// DELETE /users/:id - delete user by ID (admin only)
	router.delete('/:id', usersController.deleteUserHandler);

	// PATCH /users/password - update user password
	router.patch('/:id/reset-password', usersController.updateUserPasswordHandler);

	//PATCH /user/:id - update user info by admin
	router.patch('/:id', usersController.updateUserHandler);

	return router;
}
