import { useUsersExist } from '@/hooks/queries';
import { isPlaygroundMode } from '@/lib/playground';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface AuthGuardProps {
	children: React.ReactNode;
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
	const navigate = useNavigate();
	const location = useLocation();
	const playgroundMode = isPlaygroundMode();
	const { data: usersExist, isLoading, error } = useUsersExist({ enabled: !playgroundMode });

	useEffect(() => {
		if (playgroundMode) {
			return;
		}

		// Check if user is already authenticated
		const jwt = localStorage.getItem('jwt');
		const isOnRegisterPage = location.pathname === '/register';
		const isOnLoginPage = location.pathname === '/login';
		const isOnForgotPasswordPage = location.pathname === '/forgot-password';
		const isOnResetPasswordPage = location.pathname === '/reset-password';

		if (isLoading) {
			// Still loading, don't redirect yet
			return;
		}

		if (error) {
			// If there's an error checking users, default to login page
			if (!jwt && (isOnLoginPage || isOnForgotPasswordPage || isOnResetPasswordPage)) {
				return;
			}
			// Otherwise, redirect to login
			if (!jwt) {
				navigate('/login');
			}
			return;
		}

		// If no users exist and user is not authenticated
		if (!usersExist && !jwt) {
			// Only redirect to register if not already on register page
			if (!isOnRegisterPage) {
				navigate('/register');
			}
			return;
		}

		// If users exist but user is not authenticated
		if (usersExist && !jwt) {
			if (isOnForgotPasswordPage || isOnResetPasswordPage) {
				return;
			}

			// Only redirect to login if not already on login page
			if (!isOnLoginPage) {
				navigate('/login');
			}
			return;
		}

		// If user is authenticated and trying to access register/login pages, redirect to dashboard
		if (jwt && (isOnRegisterPage || isOnLoginPage || isOnForgotPasswordPage || isOnResetPasswordPage)) {
			navigate('/');
			return;
		}

		// If user is authenticated, allow access to the app
		if (jwt) {
			// User is authenticated, allow access
			return;
		}
	}, [usersExist, isLoading, error, navigate, location.pathname, playgroundMode]);

	if (playgroundMode) {
		return <>{children}</>;
	}

	// Show loading state while checking
	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-lg">Loading...</div>
			</div>
		);
	}

	// If there's an error and no JWT, show error state
	if (error && !localStorage.getItem('jwt')) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-lg text-red-500">Error loading application</div>
			</div>
		);
	}

	return <>{children}</>;
};
