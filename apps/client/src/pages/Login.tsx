import { Logger } from '@OpsiMate/shared';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useFormErrors } from '../hooks/useFormErrors';
import { apiRequest, EMAIL_STATUS_URL } from '../lib/api';

const logger = new Logger('Login');

const Login: React.FC = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [emailEnabled, setEmailEnabled] = useState(false);
	const { generalError, clearErrors, handleApiResponse } = useFormErrors({
		showFieldErrors: false,
	});

	useEffect(() => {
		if (localStorage.getItem('jwt') && window.location.pathname === '/login') {
			window.location.href = '/';
		}

		const fetchEmailStatus = async () => {
			try {
				const res = await fetch(EMAIL_STATUS_URL);
				const data = await res.json();
				if (data.success) {
					setEmailEnabled(data.emailEnabled);
				} else {
					logger.error('Failed to fetch email status', data);
					setEmailEnabled(false);
				}
			} catch (err) {
				logger.error('Failed to fetch email status', err);
				setEmailEnabled(false);
			}
		};

		fetchEmailStatus();
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		clearErrors();

		try {
			const res = await apiRequest<{
				token: string;
				data: { user: { id: string; email: string; name: string } };
				error?: string;
			}>('/users/login', 'POST', { email, password });

			if (res.success) {
				const token = (res.data && res.data.token) || res.token;
				if (token) {
					localStorage.setItem('jwt', token);
					window.location.href = '/';
				} else {
					logger.error('Login successful but no token received');
					handleApiResponse({
						success: false,
						error: 'Login successful but no token received',
					});
				}
			} else {
				handleApiResponse(res);
			}
		} catch (err) {
			handleApiResponse({
				success: false,
				error: 'Network error. Please check your connection and try again.',
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<form
				onSubmit={handleSubmit}
				className="bg-card text-card-foreground border border-border p-8 rounded shadow-md w-80"
			>
				<h2 className="text-2xl font-bold mb-6 text-center text-foreground">Login</h2>
				<div className="mb-4">
					<Input
						type="email"
						placeholder="Email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
				</div>
				<div className="mb-4">
					<Input
						type="password"
						placeholder="Password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
				</div>
				{generalError && <ErrorAlert message={generalError} className="mb-4" />}
				<Button type="submit" className="w-full" disabled={loading}>
					{loading ? 'Logging in...' : 'Login'}
				</Button>
				<div className="mt-4 text-center">
					{emailEnabled && (
						<Link to="/forgot-password" className="text-primary hover:underline text-sm">
							Forgot password?
						</Link>
					)}
				</div>
			</form>
		</div>
	);
};

export default Login;
