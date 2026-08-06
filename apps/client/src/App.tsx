// src/App.tsx
import { Alerts, AuthGuard, MobileWebOverlay, Profile, ThemeProvider } from '@/components';
import { Dashboards } from '@/components/Dashboards';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import { UnsavedChangesDialog } from '@/components/shared';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardProvider, useDashboard } from '@/context/DashboardContext';
import { Actions, Enrichments, Integrations, Login, NotFound, Register, Settings, MutePolicies, Oncall } from '@/pages';
import { isPlaygroundMode } from '@/lib/playground';
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
	// The playground/demo defaults to light mode for a consistent first impression.
	const playground = isPlaygroundMode();
	// Chakra injects its reset and global theme styles as *unlayered* Emotion CSS, which outranks
	// Tailwind 4's `@layer utilities` regardless of specificity — that wiped out every border and
	// button background (reset) and forced `border-color` to Chakra's gray.200 (global styles).
	// Tailwind's preflight is this app's reset; Chakra is only here for the actions modal.
	// BrowserRouter opts in to the v7 behaviors: silences the future-flag console warnings and
	// makes the eventual React Router 7 upgrade a no-op. Safe here — state updates tolerate
	// startTransition, and the only splat route (NotFound) has no relative router links.
	return (
		<ChakraProvider resetCSS={false} disableGlobalStyle>
			<ThemeProvider
				attribute="class"
				defaultTheme={playground ? 'light' : 'system'}
				enableSystem={!playground}
				disableTransitionOnChange
				enableColorScheme={false}
				storageKey="theme"
			>
				<QueryClientProvider client={queryClient}>
					<DashboardProvider>
						<TooltipProvider>
							<Toaster />
							<Sonner />
							<UnsavedChangesDialogWrapper />

							<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
								<AuthGuard>
									<Routes>
										<Route path="/" element={<Alerts />} />
										<Route path="/dashboards" element={<Dashboards />} />
										<Route path="/integrations" element={<Integrations />} />
										<Route path="/settings" element={<Settings />} />
										<Route path="/profile" element={<Profile />} />
										<Route path="/login" element={<Login />} />
										<Route path="/register" element={<Register />} />
										<Route path="/alerts" element={<Alerts />} />
										<Route path="/mute-policies" element={<MutePolicies />} />
										<Route path="/oncall" element={<Oncall />} />
										<Route path="/actions" element={<Actions />} />
										<Route path="/enrichments" element={<Enrichments />} />
										<Route path="/forgot-password" element={<ForgotPassword />} />
										<Route path="/reset-password" element={<ResetPasswordByEmail />} />
										<Route path="*" element={<NotFound />} />
									</Routes>
								</AuthGuard>
							</BrowserRouter>

							<ScrollToTopButton />
							<MobileWebOverlay />
						</TooltipProvider>
					</DashboardProvider>
				</QueryClientProvider>
			</ThemeProvider>
		</ChakraProvider>
	);
};

export default App;
