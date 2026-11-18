import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../components/ThemeProvider';
import { TooltipProvider } from '../components/ui/tooltip';

const createTestQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
			mutations: {
				retry: false,
			},
		},
	});

interface AllTheProvidersProps {
	children: ReactNode;
}

export const AllTheProviders = ({ children }: AllTheProvidersProps) => {
	const testQueryClient = createTestQueryClient();

	return (
		<QueryClientProvider client={testQueryClient}>
			<ThemeProvider defaultTheme="light">
				<TooltipProvider delayDuration={0}>
					<BrowserRouter>{children}</BrowserRouter>
				</TooltipProvider>
			</ThemeProvider>
		</QueryClientProvider>
	);
};
