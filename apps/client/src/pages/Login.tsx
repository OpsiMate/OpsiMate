import { AUTH_TOKEN_STORAGE_KEY } from '../lib/auth';
import { Logger } from '@OpsiMate/shared';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useFormErrors } from '../hooks/useFormErrors';
import { apiRequest, EMAIL_STATUS_URL } from '../lib/api';
import { isPlaygroundMode } from '../lib/playground';
import { ROUTES } from '@/lib/routes';

const logger = new Logger('Login');

const Login: React.FC = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [emailEnabled, setEmailEnabled] = useState(false);
	// Set when the server completes a bare name with a domain: the field then takes a name too.
	const [defaultEmailDomain, setDefaultEmailDomain] = useState<string | null>(null);
	const { generalError, clearErrors, handleApiResponse } = useFormErrors({
		showFieldErrors: false,
	});

	useEffect(() => {
		if (localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) && window.location.pathname === ROUTES.login) {
			window.location.href = ROUTES.home;
		}

		if (isPlaygroundMode()) {
			return;
		}

		const fetchEmailStatus = async () => {
			try {
				const res = await fetch(EMAIL_STATUS_URL);
				const data = await res.json();

				if (data.success) {
					setEmailEnabled(data.data.isEmailEnabled);
					setDefaultEmailDomain(data.data.loginDefaultEmailDomain ?? null);
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
					localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
					window.location.href = ROUTES.home;
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
		} catch {
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
						type={defaultEmailDomain ? 'text' : 'email'}
						placeholder={defaultEmailDomain ? 'Email or username' : 'Email'}
						aria-label={defaultEmailDomain ? 'Email or username' : 'Email'}
						autoComplete="username"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
					{defaultEmailDomain && email.trim() !== '' && !email.includes('@') && (
						<p className="mt-1 text-xs text-muted-foreground">
							Signs in as {email.trim()}@{defaultEmailDomain}
						</p>
					)}
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
						<Link to={ROUTES.forgotPassword} className="text-primary hover:underline text-sm">
							Forgot password?
						</Link>
					)}
				</div>
			</form>
		</div>
	);
};

export default Login;
