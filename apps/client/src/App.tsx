// src/App.tsx
import React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
	Providers,
	Integrations,
	NotFound,
	Register,
	Login,
	Settings,
	Alerts,
	AlertsTVMode,
	TVMode,
} from './pages';
import { Dashboard } from '@/components/Dashboard';
import { Profile } from '@/components/Profile';
import { ThemeProvider } from './components/ThemeProvider';
import { AuthGuard } from './components/AuthGuard';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import { isEditor } from './lib/auth';
import ForgotPassword from './pages/ForgotPassword';
import ResetPasswordByEmail from './pages/ResetPasswordByEmail';

const queryClient = new QueryClient();

const App: React.FC = () => {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					<Toaster />
					<Sonner />

					<BrowserRouter>
						<AuthGuard>
							<Routes>
								<Route path="/" element={<Dashboard />} />
								<Route path="/tv-mode" element={<TVMode />} />
								<Route
									path="/providers"
									element={!isEditor() ? <Navigate to="/" replace /> : <Providers />}
								/>
								<Route path="/integrations" element={<Integrations />} />
								<Route path="/settings" element={<Settings />} />
								<Route path="/profile" element={<Profile />} />
								<Route path="/login" element={<Login />} />
								<Route path="/register" element={<Register />} />
								<Route path="/alerts" element={<Alerts />} />
								<Route path="/alerts/tv-mode" element={<AlertsTVMode />} />
								<Route path="/forgot-password" element={<ForgotPassword />} />
								<Route path="/reset-password" element={<ResetPasswordByEmail />} />
								<Route path="*" element={<NotFound />} />
							</Routes>
						</AuthGuard>
					</BrowserRouter>

					<ScrollToTopButton />
				</TooltipProvider>
			</QueryClientProvider>
		</ThemeProvider>
	);
};

export default App;
