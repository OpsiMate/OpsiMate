import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ErrorBoundaryInner } from './ErrorBoundaryInner';

// Keyed by pathname so navigating to another page automatically clears a caught error —
// a crash on one route must not brick the rest of the app.
export const ErrorBoundary = ({ children }: { children: ReactNode }) => {
	const location = useLocation();
	return <ErrorBoundaryInner key={location.pathname}>{children}</ErrorBoundaryInner>;
};
