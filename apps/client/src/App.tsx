// src/App.tsx
import { Actions, Alerts, AuthGuard, Dashboard, Profile, Providers, ThemeProvider } from '@/components';
import { Dashboards } from '@/components/Dashboards';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import { UnsavedChangesDialog } from '@/components/shared';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardProvider, useDashboard } from '@/context/DashboardContext';
import { AlertsTVMode, Integrations, Login, NotFound, Register, Settings, TVMode } from '@/pages';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ForgotPassword from './pages/ForgotPassword';
import ResetPasswordByEmail from './pages/ResetPasswordByEmail';

const UnsavedChangesDialogWrapper = () => {
	const { showUnsavedChangesDialog, confirmNavigation, cancelNavigation } = useDashboard();
	return (
		<UnsavedChangesDialog
			open={showUnsavedChangesDialog}
			onConfirm={confirmNavigation}
			onCancel={cancelNavigation}
		/>
	);
};

const queryClient = new QueryClient();

const App: React.FC = () => {
	return (
		<ChakraProvider>
			<ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme">
				<QueryClientProvider client={queryClient}>
					<DashboardProvider>
						<TooltipProvider>
							<Toaster />
							<Sonner />
							<UnsavedChangesDialogWrapper />

							<BrowserRouter>
								<AuthGuard>
									<Routes>
										<Route path="/" element={<Alerts />} />
										<Route path="/tv-mode" element={<TVMode />} />
										<Route path="/dashboards" element={<Dashboards />} />
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
					</DashboardProvider>
				</QueryClientProvider>
			</ThemeProvider>
		</ChakraProvider>
	);
};

export default App;
