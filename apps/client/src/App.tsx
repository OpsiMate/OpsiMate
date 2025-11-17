// src/App.tsx
import { Actions, Alerts, AuthGuard, Dashboard, Profile, Providers, ThemeProvider } from '@/components';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ForgotPassword from './pages/ForgotPassword';
import ResetPasswordByEmail from './pages/ResetPasswordByEmail';
import { AlertsTVMode, Integrations, Login, NotFound, Register, Settings, TVMode } from '@/pages';
import { isEditor } from '@/lib/auth.ts';

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
