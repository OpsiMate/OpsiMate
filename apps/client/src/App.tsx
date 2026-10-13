// src/App.tsx
import { Alerts, AuthGuard, MobileWebOverlay, Profile, ThemeProvider } from '@/components';
import { Dashboards } from '@/components/Dashboards';
import { Suspense, lazy } from 'react';
import { ErrorBoundary, ErrorBoundaryInner } from '@/components/ErrorBoundary';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import { UnsavedChangesDialog } from '@/components/shared';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardProvider, useDashboard } from '@/context/DashboardContext';
import { Actions, Enrichments, Integrations, Login, NotFound, Register, Settings, MutePolicies, Oncall } from '@/pages';
import { isPlaygroundMode } from '@/lib/playground';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ForgotPassword from './pages/ForgotPassword';
import ResetPasswordByEmail from './pages/ResetPasswordByEmail';
import { ROUTES } from '@/lib/routes';

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

// Lazy: Insights carries the whole charting library (~450KB); users who never open
// it must not download it, and the alerts table's first paint must not wait on it.
const AlertInsights = lazy(() => import('./pages/AlertInsights'));

const queryClient = new QueryClient();

const App: React.FC = () => {
	// The playground/demo defaults to light mode for a consistent first impression.
	const playground = isPlaygroundMode();
	// BrowserRouter opts in to the v7 behaviors: silences the future-flag console warnings and
	// makes the eventual React Router 7 upgrade a no-op. Safe here — state updates tolerate
	// startTransition, and the only splat route (NotFound) has no relative router links.
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme={playground ? 'light' : 'system'}
			enableSystem={!playground}
			disableTransitionOnChange
			enableColorScheme={false}
			storageKey="theme"
		>
			<QueryClientProvider client={queryClient}>
				{/* Router-free outer boundary: DashboardProvider renders ABOVE the
					    pathname-keyed ErrorBoundary inside BrowserRouter, so a crash in the
					    provider itself (e.g. a malformed persisted dashboard state) used to
					    unmount everything into a blank white page with no card. */}
				<ErrorBoundaryInner>
					<DashboardProvider>
						<TooltipProvider>
							<Toaster />
							<Sonner />
							<UnsavedChangesDialogWrapper />

							<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
								<ErrorBoundary>
									<AuthGuard>
										<Routes>
											<Route path={ROUTES.home} element={<Alerts />} />
											<Route path={ROUTES.dashboard} element={<Dashboards />} />
											<Route
												path={ROUTES.alertInsights}
												element={
													<Suspense fallback={null}>
														<AlertInsights />
													</Suspense>
												}
											/>
											<Route path={ROUTES.integrations} element={<Integrations />} />
											<Route path={ROUTES.settings} element={<Settings />} />
											<Route path={ROUTES.profile} element={<Profile />} />
											<Route path={ROUTES.login} element={<Login />} />
											<Route path={ROUTES.register} element={<Register />} />
											<Route path={ROUTES.alerts} element={<Alerts />} />
											<Route path={ROUTES.mutePolicies} element={<MutePolicies />} />
											<Route path={ROUTES.oncall} element={<Oncall />} />
											<Route path={ROUTES.actions} element={<Actions />} />
											<Route path={ROUTES.enrichments} element={<Enrichments />} />
											<Route path={ROUTES.forgotPassword} element={<ForgotPassword />} />
											<Route
												path={ROUTES.resetPasswordByEmail}
												element={<ResetPasswordByEmail />}
											/>
											<Route path="*" element={<NotFound />} />
										</Routes>
									</AuthGuard>
								</ErrorBoundary>
							</BrowserRouter>

							<ScrollToTopButton />
							<MobileWebOverlay />
						</TooltipProvider>
					</DashboardProvider>
				</ErrorBoundaryInner>
			</QueryClientProvider>
		</ThemeProvider>
	);
};

export default App;
