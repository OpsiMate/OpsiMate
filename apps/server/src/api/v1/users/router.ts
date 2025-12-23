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

	// Avatar routes
	// GET /users/profile/avatar/upload-url - get presigned upload URL
	router.get('/profile/avatar/upload-url', usersController.getAvatarUploadUrlHandler);

	// PATCH /users/profile/avatar - confirm avatar upload
	router.patch('/profile/avatar', usersController.confirmAvatarUploadHandler);

	// DELETE /users/profile/avatar - delete avatar
	router.delete('/profile/avatar', usersController.deleteAvatarHandler);

	// DELETE /users/:id - delete user by ID (admin only)
	router.delete('/:id', usersController.deleteUserHandler);

	// PATCH /users/password - update user password
	router.patch('/:id/reset-password', usersController.updateUserPasswordHandler);

	//PATCH /user/:id - update user info by admin
	router.patch('/:id', usersController.updateUserHandler);

	return router;
}
