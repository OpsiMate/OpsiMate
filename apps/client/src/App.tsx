// src/App.tsx
import { Actions, Dashboard, Profile } from '@/components';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import { ThemeProvider } from './components/ThemeProvider';
import { isEditor } from './lib/auth';
import { Alerts, Integrations, Login, MyProviders, NotFound, Providers, Register, Settings, TVMode } from './pages';
import ForgotPassword from './pages/ForgotPassword';
import ResetPasswordByEmail from './pages/ResetPasswordByEmail';

const queryClient = new QueryClient();

const App: React.FC = () => {
	return (
		<ChakraProvider>
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
									<Route path="/providers" element={<Providers />} />
									<Route
										path="/my-providers"
										element={!isEditor() ? <Navigate to="/" replace /> : <MyProviders />}
									/>
									<Route path="/integrations" element={<Integrations />} />
									<Route path="/settings" element={<Settings />} />
									<Route path="/profile" element={<Profile />} />
									<Route path="/login" element={<Login />} />
									<Route path="/register" element={<Register />} />
									<Route path="/alerts" element={<Alerts />} />
									<Route
										path="/actions"
										element={!isEditor() ? <Navigate to="/" replace /> : <Actions />}
									/>
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
		</ChakraProvider>
	);
};

export default App;
